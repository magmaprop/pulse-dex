import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { EngineManager } from "./engine/matching.js";
import { PriceOracle } from "./services/oracle.js";
import { createAPIServer } from "./api/server.js";
import { WebSocketServer, WebSocket } from "ws";
import { checkPositionHealth, calculateFundingRate, calculateMarkPrice } from "./engine/risk.js";
import type { MarginConfig } from "./engine/risk.js";

const PORT = parseInt(process.env.PORT || "4000");

async function main() {
  console.log("Pulse DEX Backend Starting...");

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log("Database connected");

  const marketCount = await prisma.market.count();
  if (marketCount === 0) { await seedMarkets(prisma); console.log("Markets seeded"); }

  const engineManager = new EngineManager();
  const markets = await prisma.market.findMany({ where: { status: "ACTIVE" } });
  for (const market of markets) { engineManager.getOrCreate(market.id); console.log("Engine: " + market.symbol); }

  const oracle = new PriceOracle();
  await oracle.start(markets.map((m) => m.symbol));
  console.log("Oracle connected");

  const api = createAPIServer(prisma, engineManager, oracle);
  const server = api.listen(PORT, "0.0.0.0", () => { console.log("HTTP on port " + PORT); });

  const wss = new WebSocketServer({ server: server, path: "/ws" });
  console.log("WebSocket on /ws");

  const clients = new Map();
  let cc = 0;

  wss.on("connection", (ws) => {
    const id = "c" + (++cc);
    const client = { ws: ws, subs: new Set(), alive: true };
    clients.set(id, client);
    ws.on("pong", () => { client.alive = true; });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe") {
          const ch = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
          ch.forEach((c) => client.subs.add(c));
          ws.send(JSON.stringify({ type: "subscribed", channels: Array.from(client.subs) }));
        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (e) {}
    });
    ws.on("close", () => { clients.delete(id); });
    ws.send(JSON.stringify({ type: "connected", clientId: id, timestamp: Date.now() }));
  });

  setInterval(() => {
    clients.forEach((client, id) => {
      if (!client.alive) { client.ws.terminate(); clients.delete(id); return; }
      client.alive = false;
      client.ws.ping();
    });
  }, 30000);

  oracle.on("price", (price) => {
    const msg = JSON.stringify({ type: "ticker", channel: "ticker:" + price.symbol, data: price, timestamp: Date.now() });
    clients.forEach((client) => {
      if (client.subs.has("ticker:" + price.symbol) && client.ws.readyState === 1) {
        client.ws.send(msg);
      }
    });
  });

  console.log("All systems go on port " + PORT);
}

async function seedMarkets(prisma) {
  const mkts = [
    { id: "btc-usd", symbol: "BTC-USD", baseAsset: "BTC", maxLeverage: 50, tickSize: 0.1, stepSize: 0.001, initialMarginFraction: 0.02, maintenanceMarginFraction: 0.01, closeOutMarginFraction: 0.005 },
    { id: "eth-usd", symbol: "ETH-USD", baseAsset: "ETH", maxLeverage: 50, tickSize: 0.01, stepSize: 0.01, initialMarginFraction: 0.02, maintenanceMarginFraction: 0.01, closeOutMarginFraction: 0.005 },
    { id: "sol-usd", symbol: "SOL-USD", baseAsset: "SOL", maxLeverage: 25, tickSize: 0.001, stepSize: 0.1, initialMarginFraction: 0.04, maintenanceMarginFraction: 0.02, closeOutMarginFraction: 0.01 },
    { id: "arb-usd", symbol: "ARB-USD", baseAsset: "ARB", maxLeverage: 20, tickSize: 0.0001, stepSize: 1, initialMarginFraction: 0.05, maintenanceMarginFraction: 0.025, closeOutMarginFraction: 0.0125 },
    { id: "doge-usd", symbol: "DOGE-USD", baseAsset: "DOGE", maxLeverage: 20, tickSize: 0.00001, stepSize: 10, initialMarginFraction: 0.05, maintenanceMarginFraction: 0.025, closeOutMarginFraction: 0.0125 },
    { id: "eur-usd", symbol: "EUR-USD", baseAsset: "EUR", maxLeverage: 25, tickSize: 0.00001, stepSize: 100, initialMarginFraction: 0.04, maintenanceMarginFraction: 0.02, closeOutMarginFraction: 0.01 },
  ];
  for (const m of mkts) { await prisma.market.create({ data: m }); }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
