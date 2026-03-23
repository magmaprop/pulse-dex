// ─── Market Types ──────────────────────────────────────────────
export interface Market {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  nextFunding: number; // timestamp
  maxLeverage: number;
  tickSize: number;
  stepSize: number;
  initialMarginFraction: number;
  maintenanceMarginFraction: number;
  status: "active" | "paused" | "settlement";
}

// ─── Order Types ───────────────────────────────────────────────
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop_market" | "stop_limit";
export type OrderStatus = "open" | "partial" | "filled" | "cancelled" | "expired";
export type TimeInForce = "gtc" | "ioc" | "fok";

export interface Order {
  id: string;
  marketId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  triggerPrice?: number;
  size: number;
  filledSize: number;
  remainingSize: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  postOnly: boolean;
  reduceOnly: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewOrderRequest {
  marketId: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  triggerPrice?: number;
  size: number;
  leverage: number;
  timeInForce?: TimeInForce;
  postOnly?: boolean;
  reduceOnly?: boolean;
  takeProfit?: number;
  stopLoss?: number;
}

// ─── Position Types ────────────────────────────────────────────
export type PositionSide = "long" | "short";

export interface Position {
  id: string;
  marketId: string;
  symbol: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  pnlPercentage: number;
  marginMode: "cross" | "isolated";
  createdAt: number;
}

// ─── Account Types ─────────────────────────────────────────────
export interface AccountBalance {
  asset: string;
  available: number;
  locked: number;
  total: number;
}

export interface AccountInfo {
  address: string;
  accountIndex: number;
  accountType: "standard" | "premium";
  equity: number;
  availableMargin: number;
  usedMargin: number;
  unrealizedPnl: number;
  balances: AccountBalance[];
  positions: Position[];
  openOrders: Order[];
}

// ─── Order Book Types ──────────────────────────────────────────
export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  spread: number;
  spreadPercentage: number;
  lastUpdateId: number;
}

// ─── Trade Types ───────────────────────────────────────────────
export interface Trade {
  id: string;
  marketId: string;
  price: number;
  size: number;
  side: OrderSide;
  timestamp: number;
}

// ─── Candle Types ──────────────────────────────────────────────
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Pool / Earn Types ─────────────────────────────────────────
export interface Pool {
  id: string;
  name: string;
  description: string;
  operator: string;
  tvl: number;
  apy: number;
  totalShares: number;
  userShares: number;
  userValue: number;
  status: "active" | "paused" | "closed";
  riskLevel: "low" | "medium" | "high" | "very_high";
  sharePriceHistory: { timestamp: number; price: number }[];
  dailyReturns: { timestamp: number; return: number }[];
}

export interface StakingInfo {
  totalStaked: number;
  userStake: number;
  apy: number;
  tokenPrice: number;
  llpAccessRatio: number; // 1 PULSE staked = X USDC in LLP
  fundingRebatePercent: number;
  unstakingPeriod: number; // hours
}

// ─── Points / Leaderboard ──────────────────────────────────────
export type LeaderboardTier = "diamond" | "gold" | "silver" | "bronze";

export interface LeaderboardEntry {
  rank: number;
  address: string;
  points: number;
  volume: number;
  trades: number;
  pnl: number;
  tier: LeaderboardTier;
}

export interface PointsSeason {
  id: number;
  name: string;
  startDate: number;
  endDate: number;
  totalPoints: number;
  weeklyDistribution: number;
  isActive: boolean;
}

export interface UserPoints {
  seasonId: number;
  totalPoints: number;
  rank: number;
  weeklyPoints: number;
  referralPoints: number;
  tradingPoints: number;
}

// ─── Transaction Types ─────────────────────────────────────────
export type TransactionType = "deposit" | "withdrawal" | "transfer";
export type TransactionStatus = "pending" | "confirmed" | "failed";
export type SupportedChain = "ethereum" | "arbitrum" | "base" | "avalanche";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  asset: string;
  chain: SupportedChain;
  hash: string;
  status: TransactionStatus;
  timestamp: number;
}

// ─── Price Feed Types ──────────────────────────────────────────
export interface PriceFeed {
  id: string;
  symbol: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

// ─── WebSocket Message Types ───────────────────────────────────
export type WSMessageType =
  | "orderbook"
  | "trade"
  | "position"
  | "order"
  | "account"
  | "market"
  | "funding";

export interface WSMessage {
  type: WSMessageType;
  channel: string;
  data: unknown;
  timestamp: number;
}
