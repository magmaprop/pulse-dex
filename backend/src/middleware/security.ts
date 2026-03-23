/**
 * Production middleware: rate limiting, SIWE verification, request logging
 */

import { Request, Response, NextFunction } from "express";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { SiweMessage } from "siwe";
import jwt from "jsonwebtoken";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

// ─── Rate Limiters ─────────────────────────────────────────────

// General API: 100 requests per minute per IP
const generalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
  blockDuration: 60, // Block for 1 min if exceeded
});

// Order placement: 10 orders per second per user
const orderLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
  blockDuration: 5,
});

// Auth endpoints: 5 attempts per minute per IP
const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 300, // Block for 5 min if exceeded
});

// WebSocket connections: 5 per IP
const wsLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

export function rateLimitGeneral(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  generalLimiter
    .consume(ip)
    .then(() => next())
    .catch(() => {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: 60,
      });
    });
}

export function rateLimitOrders(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId || req.ip || "unknown";
  orderLimiter
    .consume(userId)
    .then(() => next())
    .catch(() => {
      res.status(429).json({
        error: "Order rate limit exceeded. Max 10 orders/second.",
        retryAfter: 5,
      });
    });
}

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  authLimiter
    .consume(ip)
    .then(() => next())
    .catch(() => {
      res.status(429).json({
        error: "Too many auth attempts. Try again in 5 minutes.",
        retryAfter: 300,
      });
    });
}

// ─── SIWE (Sign In With Ethereum) Verification ────────────────

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL_MAINNET),
});

/**
 * Verify a SIWE message and signature
 * Returns the verified Ethereum address
 */
export async function verifySIWE(
  message: string,
  signature: string
): Promise<{ address: string; chainId: number } | null> {
  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({
      signature,
      // In production, also verify domain, nonce, etc.
    });

    if (result.success) {
      return {
        address: result.data.address.toLowerCase(),
        chainId: result.data.chainId,
      };
    }
    return null;
  } catch (err) {
    console.error("[Auth] SIWE verification failed:", err);
    return null;
  }
}

/**
 * Generate a JWT token for an authenticated user
 */
export function generateToken(userId: string, address: string): string {
  return jwt.sign(
    { userId, address },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(
  token: string
): { userId: string; address: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      address: string;
    };
  } catch {
    return null;
  }
}

// ─── Enhanced Auth Middleware ───────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userAddress?: string;
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.userId = decoded.userId;
  req.userAddress = decoded.address;
  next();
}

/**
 * Optional auth — attaches user info if token present, but doesn't block
 */
export function authOptional(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.userAddress = decoded.address;
    }
  }
  next();
}

// ─── Request Logging ───────────────────────────────────────────

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, path } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 400 ? "WARN" : "INFO";

    // Don't log health checks in production
    if (path === "/api/health" && statusCode === 200) return;

    console.log(
      `[${level}] ${method} ${path} ${statusCode} ${duration}ms`
    );
  });

  next();
}

// ─── CORS Configuration ────────────────────────────────────────

export const corsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? [
        process.env.FRONTEND_URL || "https://pulse.trade",
        "https://app.pulse.trade",
      ]
    : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// ─── Security Headers ──────────────────────────────────────────

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss://ws.pulse.trade https://hermes.pyth.network"
    );
  }

  next();
}
