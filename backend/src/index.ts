import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { EngineManager } from "./engine/matching.js";
import { PriceOracle } from "./services/oracle.js";
import { createAPIServer } from "./api/server.js";
import { WebSocketServer, WebSocket } from "ws";
import {
  checkPositionHealth,
  processLiquidation,
  calculateFundingRate,
  calculateFundingPayment,
  calculateMarkPrice,
} from "./engine/risk.js";
import type { MarginConfig } from "./engine/risk.js";

const PORT = parseInt(process.env.PORT || "4000");

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Pulse DEX Backend — Starting...");
  console.log("═══════════════════════════════════════════");

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log("✅ Database connected");

  const marketCount = await prisma.market.count();
  if (marketCount === 0) {
    await seedMarkets(prisma);
    console.log("✅ Markets seeded");
  }

  const engineManager = new EngineManager();
  const markets = await prisma.market.findMany({ where: { status: "ACTIVE" } });

  for (const market of markets) {
    engineManager.getOrCreate(market.id);
    console.log(`  ⚡ Engine ready: ${market.symbol}`);
  }
  console.log(`✅ ${markets.length} matching engines initialized`);

  const oracle = new PriceOracle();
  await oracle.start(markets.map((m) => m.symbol));
  console.log("✅ Pyth price oracle connected");

  const api = createAPIServer(prisma, engineManager, oracle);

  const server = api.listen(PORT, () => {
    console.log(`✅ HTTP API on port ${PORT}`);
  });

  // WebSocket on SAME server (required for Railway single-port)
  const wss = new WebSocketServer({ server, path: "/ws" });
  console.log(`✅ WebSocket on port ${PORT}/ws`);

  const clients = new Map<string, { ws: WebSocket; subs: Set<string>; userId?: string; alive: boolean }>();
  let clientCount = 0;

  wss.on("connection", (ws) => {
    const id = `ws_${++clientCount}`;
    const client = { ws, subs: new Set<string>(), alive: true };
    clients.set(id, client);

    ws.on("pong", () => { client.alive = true; });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe") {
          const channels: string[] = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          channels.forEach((c) => client.subs.add(c));
          ws.send(JSON.stringify({ type: "subscribed", channels: Array.from(client.subs) }));
        } else if (msg.type === "unsubscribe") {
          const channels: string[] = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          channels.forEach((c) => client.subs.delete(c));
        } else if (msg.type === "auth") {
          client.userId = msg.userId;
          ws.send(JSON.stringify({ type: "authenticated", userId: msg.userId }));
        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on("close", () => { clients.delete(id); });
    ws.send(JSON.stringify({ type: "connected", clientId: id, timestamp: Date.now() }));
  });

  // Heartbeat
  setInterval(() => {
    clients.forEach((client, id) => {
      if (!client.alive) { client.ws.terminate(); clients.delete(id); return; }
      client.alive = false;
      client.ws.ping();
    });
  }, 30000);

  // Broadcast helper
  function broadcast(channel: string, data: any) {
    const msg = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.subs.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    });
  }

  // Broadcast oracle prices
  oracle.on("price", (price: any) => {
    broadcast(`ticker:${price.symbol}`, {
      type: "ticker",
      channel: `ticker:${price.symbol}`,
      data: price,
      timestamp: Date.now(),
    });
  });

  // Risk monitoring every 5s
  setInterval(async () => {
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
          { userId: position.userId, marketId: position.marketId, side: position.side as "LONG" | "SHORT", size: position.size, entryPrice: position.entryPrice, margin: position.margin, leverage: position.leverage },
          oraclePrice, config
        );
        if (health.health === "liquidation" || health.health === "bankrupt") {
          console.log(`🚨 LIQUIDATION: ${position.userId} ${position.market.symbol}`);
          await prisma.position.update({ where: { id: position.id }, data: { status: "LIQUIDATED", closedAt: new Date() } });
        }
      }
    } catch (err) {
      console.error("[Risk] Error:", err);
    }
  }, 5000);

  // Funding rate every hour
  setInterval(async () => {
    for (const market of markets) {
      const oraclePrice = oracle.getPrice(market.symbol)?.price;
      const engine = engineManager.get(market.id);
      if (!oraclePrice || !engine) continue;
      const lastPrice = engine.getLastPrice();
      const markPrice = calculateMarkPrice(lastPrice || oraclePrice, oraclePrice);
      const fundingRate = calculateFundingRate(markPrice, oraclePrice);
      try {
        await prisma.fundingRate.create({ data: { marketId: market.id, rate: fundingRate, markPrice, indexPrice: oraclePrice } });
      } catch {}
    }
  }, 3600000);

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    oracle.stop();
    await prisma.$disconnect();
    process.exit(0);
  });

  console.log("═══════════════════════════════════════════");
  console.log("  ✅ All systems operational");
  console.log(`  HTTP + WS on port ${PORT}`);
  console.log("═══════════════════════════════════════════");
}

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

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
```

**Fix 2: Update the frontend WebSocket URL to use `/ws` path**

Edit:
```
https://github.com/botnetpy/pulse-dex/edit/main/src/hooks/useWebSocket.ts
```

Find this line near the top:
```
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001";
```

Replace with:
```
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000") + "/ws";
```

**Fix 3: Update Vercel env var**

Go to Vercel → Settings → Environment Variables → change:
```
NEXT_PUBLIC_WS_URL = wss://pulse-dex-production.up.railway.app
