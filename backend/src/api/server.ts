/**
 * REST API Server
 * 
 * Endpoints:
 * - POST   /api/auth/login        - SIWE (Sign In With Ethereum)
 * - GET    /api/markets            - List all markets
 * - GET    /api/markets/:id        - Market details
 * - GET    /api/orderbook/:market  - Order book snapshot
 * - POST   /api/orders             - Place order
 * - DELETE /api/orders/:id         - Cancel order
 * - GET    /api/orders             - User's open orders
 * - GET    /api/positions          - User's positions
 * - GET    /api/account            - Account balance info
 * - GET    /api/trades/:market     - Recent trades
 * - GET    /api/history/trades     - User's trade history
 * - GET    /api/history/funding    - User's funding history
 * - GET    /api/leaderboard        - Points leaderboard
 * - GET    /api/points             - User's points
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { EngineManager, type EngineOrder, type Side, type OrderType, type TimeInForce } from "../engine/matching.js";
import { canPlaceOrder, calculateInitialMargin, calculateLiquidationPrice, calculateUnrealizedPnl } from "../engine/risk.js";
import { PriceOracle } from "../services/oracle.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

// ─── Validation Schemas ────────────────────────────────────────

const PlaceOrderSchema = z.object({
  marketId: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_MARKET", "STOP_LIMIT"]),
  price: z.number().positive().optional(),
  triggerPrice: z.number().positive().optional(),
  size: z.number().positive(),
  leverage: z.number().min(1).max(100).default(1),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
  postOnly: z.boolean().default(false),
  reduceOnly: z.boolean().default(false),
  takeProfit: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
});

// ─── Auth Middleware ────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userAddress?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      address: string;
    };
    req.userId = decoded.userId;
    req.userAddress = decoded.address;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ─── API Server ────────────────────────────────────────────────

let orderCounter = 0;

export function createAPIServer(
  prisma: PrismaClient,
  engineManager: EngineManager,
  oracle: PriceOracle
) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
  app.use(express.json());

  // ─── Health ──────────────────────────────────────────────────

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
      oracle: oracle.isConnected(),
      markets: engineManager.getAll().size,
    });
  });

  // ─── Auth (SIWE - Sign In With Ethereum) ─────────────────────

  app.post("/api/auth/nonce", async (req, res) => {
    const nonce = Math.random().toString(36).substring(2, 15);
    res.json({ nonce });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { address, signature, message } = req.body;

      if (!address || !signature) {
        return res.status(400).json({ error: "Address and signature required" });
      }

      // In production: verify SIWE signature with viem/siwe
      // const isValid = await verifyMessage({ address, message, signature });

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { address: address.toLowerCase() },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            address: address.toLowerCase(),
            balances: {
              create: { asset: "USDC", available: 0, locked: 0 },
            },
          },
        });
      }

      const token = jwt.sign(
        { userId: user.id, address: user.address },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          address: user.address,
          accountType: user.accountType,
          referralCode: user.referralCode,
        },
      });
    } catch (err) {
      console.error("[API] Auth error:", err);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // ─── Markets ─────────────────────────────────────────────────

  app.get("/api/markets", async (req, res) => {
    const markets = await prisma.market.findMany({
      where: { status: "ACTIVE" },
    });

    // Enrich with live prices
    const enriched = markets.map((m) => {
      const price = oracle.getPrice(m.symbol);
      return {
        ...m,
        price: price?.price || 0,
        indexPrice: price?.price || 0,
        confidence: price?.confidence || 0,
      };
    });

    res.json(enriched);
  });

  app.get("/api/markets/:id", async (req, res) => {
    const market = await prisma.market.findUnique({
      where: { id: req.params.id },
    });
    if (!market) return res.status(404).json({ error: "Market not found" });

    const price = oracle.getPrice(market.symbol);
    res.json({ ...market, price: price?.price || 0 });
  });

  // ─── Order Book ──────────────────────────────────────────────

  app.get("/api/orderbook/:marketId", (req, res) => {
    const engine = engineManager.get(req.params.marketId);
    if (!engine) return res.status(404).json({ error: "Market not found" });

    const depth = parseInt(req.query.depth as string) || 20;
    res.json(engine.getSnapshot(depth));
  });

  // ─── Orders ──────────────────────────────────────────────────

  app.post("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = PlaceOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid order", details: parsed.error.errors });
      }

      const { marketId, side, type, price, triggerPrice, size, leverage, timeInForce, postOnly, reduceOnly } = parsed.data;

      // Get engine
      const engine = engineManager.get(marketId);
      if (!engine) return res.status(404).json({ error: "Market not found" });

      // Check margin
      const oraclePrice = oracle.getPrice(marketId.replace("-", "-"))?.price;
      const orderPrice = price || oraclePrice || 0;
      if (orderPrice <= 0) {
        return res.status(400).json({ error: "Cannot determine order price" });
      }

      // Get user balance
      const balance = await prisma.balance.findFirst({
        where: { userId: req.userId!, asset: "USDC" },
      });

      const available = balance?.available || 0;
      const requiredMargin = calculateInitialMargin(size, orderPrice, leverage);

      if (requiredMargin > available) {
        return res.status(400).json({
          error: "Insufficient margin",
          required: requiredMargin,
          available,
        });
      }

      // Create engine order
      const engineOrder: EngineOrder = {
        id: `o_${++orderCounter}_${Date.now()}`,
        userId: req.userId!,
        marketId,
        side: side as Side,
        type: type as OrderType,
        price: price || 0,
        triggerPrice,
        size,
        remainingSize: size,
        filledSize: 0,
        avgFillPrice: 0,
        timeInForce: timeInForce as TimeInForce,
        postOnly,
        reduceOnly,
        status: "OPEN",
        timestamp: Date.now(),
      };

      // Submit to matching engine
      const result = engine.submitOrder(engineOrder);

      // Lock margin
      if (result.status === "OPEN" || result.status === "PARTIAL") {
        await prisma.balance.update({
          where: { id: balance!.id },
          data: {
            available: { decrement: requiredMargin },
            locked: { increment: requiredMargin },
          },
        });
      }

      // Persist to database
      await prisma.order.create({
        data: {
          id: result.id,
          userId: req.userId!,
          marketId,
          side,
          type,
          price,
          triggerPrice,
          size,
          filledSize: result.filledSize,
          remainingSize: result.remainingSize,
          avgFillPrice: result.avgFillPrice || null,
          status: result.status,
          timeInForce,
          postOnly,
          reduceOnly,
        },
      });

      res.json({
        order: {
          id: result.id,
          status: result.status,
          filledSize: result.filledSize,
          remainingSize: result.remainingSize,
          avgFillPrice: result.avgFillPrice,
        },
      });
    } catch (err) {
      console.error("[API] Order error:", err);
      res.status(500).json({ error: "Failed to place order" });
    }
  });

  app.delete("/api/orders/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = req.params.id;

      // Find the order
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId: req.userId! },
      });

      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== "OPEN" && order.status !== "PARTIAL") {
        return res.status(400).json({ error: "Order cannot be cancelled" });
      }

      // Cancel in engine
      const engine = engineManager.get(order.marketId);
      engine?.cancelOrder(orderId);

      // Update database
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });

      // Unlock margin
      const marginToUnlock = calculateInitialMargin(
        order.remainingSize,
        order.price || 0,
        1 // TODO: store leverage on order
      );

      await prisma.balance.updateMany({
        where: { userId: req.userId!, asset: "USDC" },
        data: {
          available: { increment: marginToUnlock },
          locked: { decrement: marginToUnlock },
        },
      });

      res.json({ success: true, orderId });
    } catch (err) {
      console.error("[API] Cancel error:", err);
      res.status(500).json({ error: "Failed to cancel order" });
    }
  });

  app.get("/api/orders", authMiddleware, async (req: AuthRequest, res: Response) => {
    const orders = await prisma.order.findMany({
      where: {
        userId: req.userId!,
        status: { in: ["OPEN", "PARTIAL"] },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  });

  // ─── Positions ───────────────────────────────────────────────

  app.get("/api/positions", authMiddleware, async (req: AuthRequest, res: Response) => {
    const positions = await prisma.position.findMany({
      where: { userId: req.userId!, status: "OPEN" },
      include: { market: true },
    });

    // Enrich with live PnL
    const enriched = positions.map((p) => {
      const oraclePrice = oracle.getPrice(p.market.symbol)?.price || p.entryPrice;
      const unrealizedPnl = calculateUnrealizedPnl(
        p.side as "LONG" | "SHORT",
        p.size,
        p.entryPrice,
        oraclePrice
      );
      const pnlPercentage = p.margin > 0 ? (unrealizedPnl / p.margin) * 100 : 0;

      return {
        ...p,
        markPrice: oraclePrice,
        unrealizedPnl,
        pnlPercentage,
      };
    });

    res.json(enriched);
  });

  // ─── Account ─────────────────────────────────────────────────

  app.get("/api/account", authMiddleware, async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        balances: true,
        positions: { where: { status: "OPEN" } },
        orders: { where: { status: { in: ["OPEN", "PARTIAL"] } } },
      },
    });

    if (!user) return res.status(404).json({ error: "Account not found" });

    const usdcBalance = user.balances.find((b) => b.asset === "USDC");
    const totalUnrealizedPnl = user.positions.reduce((sum, p) => {
      const price = oracle.getPrice(p.marketId)?.price || p.entryPrice;
      return sum + calculateUnrealizedPnl(p.side as "LONG" | "SHORT", p.size, p.entryPrice, price);
    }, 0);

    res.json({
      address: user.address,
      accountType: user.accountType,
      referralCode: user.referralCode,
      equity: (usdcBalance?.available || 0) + (usdcBalance?.locked || 0) + totalUnrealizedPnl,
      availableBalance: usdcBalance?.available || 0,
      lockedBalance: usdcBalance?.locked || 0,
      totalUnrealizedPnl,
      positionCount: user.positions.length,
      openOrderCount: user.orders.length,
    });
  });

  // ─── Recent Trades ───────────────────────────────────────────

  app.get("/api/trades/:marketId", async (req, res) => {
    const trades = await prisma.trade.findMany({
      where: { marketId: req.params.marketId },
      orderBy: { createdAt: "desc" },
      take: parseInt(req.query.limit as string) || 50,
    });
    res.json(trades);
  });

  // ─── Leaderboard ─────────────────────────────────────────────

  app.get("/api/leaderboard", async (req, res) => {
    const seasonId = parseInt(req.query.season as string) || 3;
    const limit = parseInt(req.query.limit as string) || 50;

    const entries = await prisma.userPoints.findMany({
      where: { seasonId },
      orderBy: { totalPoints: "desc" },
      take: limit,
      include: { user: { select: { address: true } } },
    });

    res.json(
      entries.map((e, i) => ({
        rank: i + 1,
        address: e.user.address,
        points: e.totalPoints,
        tradingPoints: e.tradingPoints,
        referralPoints: e.referralPoints,
      }))
    );
  });

  // ─── User Points ─────────────────────────────────────────────

  app.get("/api/points", authMiddleware, async (req: AuthRequest, res: Response) => {
    const seasonId = parseInt(req.query.season as string) || 3;

    const points = await prisma.userPoints.findFirst({
      where: { userId: req.userId!, seasonId },
      orderBy: { weekNumber: "desc" },
    });

    res.json(points || { totalPoints: 0, weeklyPoints: 0, rank: 0 });
  });

  // ─── Error Handler ───────────────────────────────────────────

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("[API] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
