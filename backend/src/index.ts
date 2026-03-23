/**
 * Pulse DEX Backend
 * 
 * Entry point that initializes and connects all services:
 * 1. Database (Prisma/PostgreSQL)
 * 2. Price Oracle (Pyth Network)
 * 3. Matching Engine (per market)
 * 4. Risk Engine + Liquidation monitor
 * 5. REST API (Express)
 * 6. WebSocket Server (real-time streaming)
 * 7. Funding Rate scheduler
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { EngineManager } from "./engine/matching.js";
import { PriceOracle } from "./services/oracle.js";
import { createAPIServer } from "./api/server.js";
import { WSServer } from "./ws/server.js";
import {
  checkPositionHealth,
  processLiquidation,
  calculateFundingRate,
  calculateFundingPayment,
  calculateMarkPrice,
  type MarginConfig,
} from "./engine/risk.js";

const PORT = parseInt(process.env.PORT || "4000");
const WS_PORT = parseInt(process.env.WS_PORT || "4001");

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Pulse DEX Backend — Starting...");
  console.log("═══════════════════════════════════════════");

  // 1. Database
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log("✅ Database connected");

  // Seed markets if they don't exist
  const marketCount = await prisma.market.count();
  if (marketCount === 0) {
    await seedMarkets(prisma);
    console.log("✅ Markets seeded");
  }

  // 2. Initialize matching engines for each market
  const engineManager = new EngineManager();
  const markets = await prisma.market.findMany({ where: { status: "ACTIVE" } });

  for (const market of markets) {
    const engine = engineManager.getOrCreate(market.id);
    console.log(`  ⚡ Engine ready: ${market.symbol}`);

    // Persist trades to database
    engine.on("trade", async (trade) => {
      try {
        await prisma.trade.create({
          data: {
            id: trade.id,
            marketId: trade.marketId,
            makerOrderId: trade.makerOrderId,
            takerOrderId: trade.takerOrderId,
            makerUserId: trade.makerUserId,
            takerUserId: trade.takerUserId,
            price: trade.price,
            size: trade.size,
            takerSide: trade.takerSide,
          },
        });
      } catch (err) {
        console.error("[DB] Failed to persist trade:", err);
      }
    });
  }
  console.log(`✅ ${markets.length} matching engines initialized`);

  // 3. Price Oracle
  const oracle = new PriceOracle();
  await oracle.start(markets.map((m) => m.symbol));
  console.log("✅ Pyth price oracle connected");

  // 4. REST API
  const api = createAPIServer(prisma, engineManager, oracle);
  api.listen(PORT, () => {
    console.log(`✅ REST API on http://localhost:${PORT}`);
  });

  // 5. WebSocket Server
  const wsServer = new WSServer(WS_PORT, engineManager, oracle);
  console.log(`✅ WebSocket on ws://localhost:${WS_PORT}`);

  // 6. Risk monitoring — check positions every 2 seconds
  const riskInterval = setInterval(async () => {
    try {
      const openPositions = await prisma.position.findMany({
        where: { status: "OPEN" },
        include: { market: true },
      });

      for (const position of openPositions) {
        const oraclePrice = oracle.getPrice(position.market.symbol)?.price;
        if (!oraclePrice) continue;

        const config: MarginConfig = {
          initialMarginFraction: position.market.initialMarginFraction,
          maintenanceMarginFraction: position.market.maintenanceMarginFraction,
          closeOutMarginFraction: position.market.closeOutMarginFraction,
          maxLeverage: position.market.maxLeverage,
        };

        const health = checkPositionHealth(
          {
            userId: position.userId,
            marketId: position.marketId,
            side: position.side as "LONG" | "SHORT",
            size: position.size,
            entryPrice: position.entryPrice,
            margin: position.margin,
            leverage: position.leverage,
          },
          oraclePrice,
          config
        );

        if (health.health === "liquidation" || health.health === "bankrupt") {
          console.log(
            `🚨 LIQUIDATION: ${position.userId} ${position.market.symbol} ${position.side} - Health: ${health.health}`
          );

          const liqEvent = processLiquidation(
            {
              userId: position.userId,
              marketId: position.marketId,
              side: position.side as "LONG" | "SHORT",
              size: position.size,
              entryPrice: position.entryPrice,
              margin: position.margin,
              leverage: position.leverage,
            },
            oraclePrice,
            config
          );

          // Close the position
          const engine = engineManager.get(position.marketId);
          if (engine) {
            // Submit a market order to close the position
            engine.submitOrder({
              id: `liq_${Date.now()}`,
              userId: position.userId,
              marketId: position.marketId,
              side: position.side === "LONG" ? "SELL" : "BUY",
              type: "MARKET",
              price: 0,
              size: position.size,
              remainingSize: position.size,
              filledSize: 0,
              avgFillPrice: 0,
              timeInForce: "IOC",
              postOnly: false,
              reduceOnly: true,
              status: "OPEN",
              timestamp: Date.now(),
            });
          }

          // Mark position as liquidated
          await prisma.position.update({
            where: { id: position.id },
            data: { status: "LIQUIDATED", closedAt: new Date() },
          });
        }
      }
    } catch (err) {
      console.error("[Risk] Monitoring error:", err);
    }
  }, 2000);

  // 7. Funding rate — calculate and apply every hour
  const fundingInterval = setInterval(async () => {
    try {
      for (const market of markets) {
        const oraclePrice = oracle.getPrice(market.symbol)?.price;
        const engine = engineManager.get(market.id);
        if (!oraclePrice || !engine) continue;

        const lastPrice = engine.getLastPrice();
        const markPrice = calculateMarkPrice(lastPrice || oraclePrice, oraclePrice);
        const fundingRate = calculateFundingRate(markPrice, oraclePrice);

        // Save funding rate
        await prisma.fundingRate.create({
          data: {
            marketId: market.id,
            rate: fundingRate,
            markPrice,
            indexPrice: oraclePrice,
          },
        });

        // Apply funding to all open positions in this market
        const positions = await prisma.position.findMany({
          where: { marketId: market.id, status: "OPEN" },
        });

        for (const position of positions) {
          const payment = calculateFundingPayment(
            {
              userId: position.userId,
              marketId: position.marketId,
              side: position.side as "LONG" | "SHORT",
              size: position.size,
              entryPrice: position.entryPrice,
              margin: position.margin,
              leverage: position.leverage,
            },
            markPrice,
            fundingRate
          );

          // Apply funding payment to user balance
          await prisma.balance.updateMany({
            where: { userId: position.userId, asset: "USDC" },
            data: { available: { increment: payment } },
          });
        }

        console.log(
          `[Funding] ${market.symbol}: rate=${(fundingRate * 100).toFixed(4)}%, mark=${markPrice.toFixed(2)}, applied to ${positions.length} positions`
        );
      }
    } catch (err) {
      console.error("[Funding] Error:", err);
    }
  }, 3600000); // Every hour

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    clearInterval(riskInterval);
    clearInterval(fundingInterval);
    oracle.stop();
    await prisma.$disconnect();
    process.exit(0);
  });

  console.log("═══════════════════════════════════════════");
  console.log("  ✅ All systems operational");
  console.log(`  REST:  http://localhost:${PORT}/api/health`);
  console.log(`  WS:    ws://localhost:${WS_PORT}`);
  console.log("═══════════════════════════════════════════");
}

// ─── Seed Markets ──────────────────────────────────────────────

async function seedMarkets(prisma: PrismaClient) {
  const markets = [
    { id: "btc-usd", symbol: "BTC-USD", baseAsset: "BTC", maxLeverage: 50, tickSize: 0.1, stepSize: 0.001, initialMarginFraction: 0.02, maintenanceMarginFraction: 0.01, closeOutMarginFraction: 0.005 },
    { id: "eth-usd", symbol: "ETH-USD", baseAsset: "ETH", maxLeverage: 50, tickSize: 0.01, stepSize: 0.01, initialMarginFraction: 0.02, maintenanceMarginFraction: 0.01, closeOutMarginFraction: 0.005 },
    { id: "sol-usd", symbol: "SOL-USD", baseAsset: "SOL", maxLeverage: 25, tickSize: 0.001, stepSize: 0.1, initialMarginFraction: 0.04, maintenanceMarginFraction: 0.02, closeOutMarginFraction: 0.01 },
    { id: "arb-usd", symbol: "ARB-USD", baseAsset: "ARB", maxLeverage: 20, tickSize: 0.0001, stepSize: 1, initialMarginFraction: 0.05, maintenanceMarginFraction: 0.025, closeOutMarginFraction: 0.0125 },
    { id: "doge-usd", symbol: "DOGE-USD", baseAsset: "DOGE", maxLeverage: 20, tickSize: 0.00001, stepSize: 10, initialMarginFraction: 0.05, maintenanceMarginFraction: 0.025, closeOutMarginFraction: 0.0125 },
    { id: "eur-usd", symbol: "EUR-USD", baseAsset: "EUR", maxLeverage: 25, tickSize: 0.00001, stepSize: 100, initialMarginFraction: 0.04, maintenanceMarginFraction: 0.02, closeOutMarginFraction: 0.01 },
  ];

  for (const m of markets) {
    await prisma.market.create({ data: m });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
