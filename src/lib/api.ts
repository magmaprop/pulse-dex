/**
 * Typed API client for Pulse DEX backend
 * Handles authentication, error handling, and all REST endpoints
 */

import type {
  Market,
  Order,
  Position,
  NewOrderRequest,
  Trade,
  AccountInfo,
  LeaderboardEntry,
  UserPoints,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class APIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("pulse_auth_token", token);
  } else {
    localStorage.removeItem("pulse_auth_token");
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("pulse_auth_token");
  }
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new APIError(body.error || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────

export async function getNonce(): Promise<{ nonce: string }> {
  return request("/api/auth/nonce", { method: "POST" });
}

export async function login(
  address: string,
  signature: string,
  message: string
): Promise<{ token: string; user: any }> {
  const result = await request<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ address, signature, message }),
    }
  );
  setAuthToken(result.token);
  return result;
}

export function logout() {
  setAuthToken(null);
}

// ─── Markets ───────────────────────────────────────────────────

export async function getMarkets(): Promise<Market[]> {
  return request("/api/markets");
}

export async function getMarket(id: string): Promise<Market> {
  return request(`/api/markets/${id}`);
}

// ─── Order Book ────────────────────────────────────────────────

export async function getOrderBook(
  marketId: string,
  depth = 20
): Promise<any> {
  return request(`/api/orderbook/${marketId}?depth=${depth}`);
}

// ─── Orders ────────────────────────────────────────────────────

export async function placeOrder(
  order: NewOrderRequest
): Promise<{ order: Order }> {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      marketId: order.marketId,
      side: order.side.toUpperCase(),
      type: order.type.toUpperCase(),
      price: order.price,
      triggerPrice: order.triggerPrice,
      size: order.size,
      leverage: order.leverage,
      timeInForce: order.timeInForce?.toUpperCase() || "GTC",
      postOnly: order.postOnly || false,
      reduceOnly: order.reduceOnly || false,
      takeProfit: order.takeProfit,
      stopLoss: order.stopLoss,
    }),
  });
}

export async function cancelOrder(
  orderId: string
): Promise<{ success: boolean }> {
  return request(`/api/orders/${orderId}`, { method: "DELETE" });
}

export async function getOpenOrders(): Promise<Order[]> {
  return request("/api/orders");
}

// ─── Positions ─────────────────────────────────────────────────

export async function getPositions(): Promise<Position[]> {
  return request("/api/positions");
}

export async function closePosition(
  marketId: string,
  size: number
): Promise<{ order: Order }> {
  // Closing a position = placing a reduce-only market order on opposite side
  const positions = await getPositions();
  const position = positions.find((p) => p.marketId === marketId);
  if (!position) throw new Error("Position not found");

  return placeOrder({
    marketId,
    side: position.side === "long" ? "sell" : "buy",
    type: "market",
    size: size || position.size,
    leverage: position.leverage,
    reduceOnly: true,
  });
}

// ─── Account ───────────────────────────────────────────────────

export async function getAccount(): Promise<any> {
  return request("/api/account");
}

// ─── Trades ────────────────────────────────────────────────────

export async function getRecentTrades(
  marketId: string,
  limit = 50
): Promise<Trade[]> {
  return request(`/api/trades/${marketId}?limit=${limit}`);
}

export async function getUserTradeHistory(): Promise<Trade[]> {
  return request("/api/history/trades");
}

// ─── Leaderboard ───────────────────────────────────────────────

export async function getLeaderboard(
  season = 3,
  limit = 50
): Promise<LeaderboardEntry[]> {
  return request(`/api/leaderboard?season=${season}&limit=${limit}`);
}

export async function getUserPoints(season = 3): Promise<UserPoints> {
  return request(`/api/points?season=${season}`);
}

// ─── Health ────────────────────────────────────────────────────

export async function getHealth(): Promise<{
  status: string;
  oracle: boolean;
  markets: number;
}> {
  return request("/api/health");
}
