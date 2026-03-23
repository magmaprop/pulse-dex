/**
 * WebSocket Server
 * 
 * Provides real-time data streaming to frontend clients:
 * - Order book updates (per market)
 * - Recent trades (per market)
 * - Account updates (positions, orders, balances)
 * - Market ticker data
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { EngineManager, type OrderBookSnapshot, type EngineTradeEvent } from "../engine/matching.js";
import { PriceOracle, type OraclePrice } from "./oracle.js";

interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  isAlive: boolean;
}

export class WSServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private clientCounter = 0;
  private engineManager: EngineManager;
  private oracle: PriceOracle;

  constructor(port: number, engineManager: EngineManager, oracle: PriceOracle) {
    this.engineManager = engineManager;
    this.oracle = oracle;

    this.wss = new WebSocketServer({ port });
    console.log(`[WS] WebSocket server started on port ${port}`);

    this.wss.on("connection", this.handleConnection.bind(this));

    // Heartbeat every 30s
    setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(id);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);

    // Wire up engine events
    this.setupEngineListeners();
    this.setupOracleListeners();
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = `ws_${++this.clientCounter}_${Date.now()}`;
    const client: WSClient = {
      ws,
      subscriptions: new Set(),
      isAlive: true,
    };

    this.clients.set(clientId, client);
    console.log(`[WS] Client connected: ${clientId} (total: ${this.clients.size})`);

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(clientId, client, msg);
      } catch (err) {
        this.send(ws, { type: "error", message: "Invalid JSON" });
      }
    });

    ws.on("close", () => {
      this.clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId} (total: ${this.clients.size})`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Client error ${clientId}:`, err.message);
    });

    // Send welcome
    this.send(ws, {
      type: "connected",
      clientId,
      timestamp: Date.now(),
    });
  }

  private handleMessage(clientId: string, client: WSClient, msg: any) {
    switch (msg.type) {
      case "subscribe":
        this.handleSubscribe(clientId, client, msg);
        break;
      case "unsubscribe":
        this.handleUnsubscribe(client, msg);
        break;
      case "auth":
        this.handleAuth(client, msg);
        break;
      case "ping":
        this.send(client.ws, { type: "pong", timestamp: Date.now() });
        break;
      default:
        this.send(client.ws, { type: "error", message: `Unknown message type: ${msg.type}` });
    }
  }

  private handleSubscribe(clientId: string, client: WSClient, msg: any) {
    const channels: string[] = Array.isArray(msg.channels) ? msg.channels : [msg.channel];

    for (const channel of channels) {
      client.subscriptions.add(channel);

      // Send initial snapshot for the subscribed channel
      if (channel.startsWith("orderbook:")) {
        const marketId = channel.split(":")[1];
        const engine = this.engineManager.get(marketId);
        if (engine) {
          this.send(client.ws, {
            type: "orderbook",
            channel,
            data: engine.getSnapshot(20),
            timestamp: Date.now(),
          });
        }
      }

      if (channel.startsWith("ticker:")) {
        const symbol = channel.split(":")[1];
        const price = this.oracle.getPrice(symbol);
        if (price) {
          this.send(client.ws, {
            type: "ticker",
            channel,
            data: price,
            timestamp: Date.now(),
          });
        }
      }
    }

    this.send(client.ws, {
      type: "subscribed",
      channels: Array.from(client.subscriptions),
    });
  }

  private handleUnsubscribe(client: WSClient, msg: any) {
    const channels: string[] = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }
    this.send(client.ws, {
      type: "unsubscribed",
      channels,
    });
  }

  private handleAuth(client: WSClient, msg: any) {
    // In production: verify JWT or signed message
    if (msg.userId) {
      client.userId = msg.userId;
      this.send(client.ws, { type: "authenticated", userId: msg.userId });
    }
  }

  // ─── Engine Event Listeners ──────────────────────────────────

  private setupEngineListeners() {
    for (const [marketId, engine] of this.engineManager.getAll()) {
      // Order book updates
      engine.on("orderbook:update", (snapshot: OrderBookSnapshot) => {
        this.broadcast(`orderbook:${marketId}`, {
          type: "orderbook",
          channel: `orderbook:${marketId}`,
          data: snapshot,
          timestamp: Date.now(),
        });
      });

      // Trade events
      engine.on("trade", (trade: EngineTradeEvent) => {
        // Broadcast to market trade channel
        this.broadcast(`trades:${marketId}`, {
          type: "trade",
          channel: `trades:${marketId}`,
          data: {
            id: trade.id,
            price: trade.price,
            size: trade.size,
            side: trade.takerSide.toLowerCase(),
            timestamp: trade.timestamp,
          },
          timestamp: Date.now(),
        });

        // Notify the specific users involved
        this.notifyUser(trade.makerUserId, {
          type: "order:fill",
          data: {
            orderId: trade.makerOrderId,
            tradeId: trade.id,
            price: trade.price,
            size: trade.size,
            role: "maker",
          },
          timestamp: Date.now(),
        });

        this.notifyUser(trade.takerUserId, {
          type: "order:fill",
          data: {
            orderId: trade.takerOrderId,
            tradeId: trade.id,
            price: trade.price,
            size: trade.size,
            role: "taker",
          },
          timestamp: Date.now(),
        });
      });

      // Order status changes
      engine.on("order:cancelled", (order: any) => {
        this.notifyUser(order.userId, {
          type: "order:update",
          data: { id: order.id, status: "CANCELLED" },
          timestamp: Date.now(),
        });
      });
    }
  }

  private setupOracleListeners() {
    this.oracle.on("price", (price: OraclePrice) => {
      this.broadcast(`ticker:${price.symbol}`, {
        type: "ticker",
        channel: `ticker:${price.symbol}`,
        data: price,
        timestamp: Date.now(),
      });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private broadcast(channel: string, data: any) {
    const msg = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (
        client.subscriptions.has(channel) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(msg);
      }
    });
  }

  private notifyUser(userId: string, data: any) {
    const msg = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (
        client.userId === userId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(msg);
      }
    });
  }

  private send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
