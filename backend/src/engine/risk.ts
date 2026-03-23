/**
 * Risk Engine
 * 
 * Handles margin calculations, position health monitoring,
 * liquidation detection, and funding rate computation.
 */

export interface MarginConfig {
  initialMarginFraction: number;    // e.g., 0.02 = 2% = 50x max leverage
  maintenanceMarginFraction: number; // e.g., 0.01 = 1%
  closeOutMarginFraction: number;    // e.g., 0.005 = 0.5%
  maxLeverage: number;
}

export interface PositionState {
  userId: string;
  marketId: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  margin: number;
  leverage: number;
}

export interface AccountState {
  equity: number;        // total balance + unrealized PnL
  availableBalance: number;
  totalMarginUsed: number;
  totalUnrealizedPnl: number;
  positions: PositionState[];
}

// ─── Margin Calculations ───────────────────────────────────────

/**
 * Calculate the initial margin required to open a position
 */
export function calculateInitialMargin(
  size: number,
  price: number,
  leverage: number
): number {
  const notional = size * price;
  return notional / leverage;
}

/**
 * Calculate maintenance margin for an existing position
 */
export function calculateMaintenanceMargin(
  size: number,
  markPrice: number,
  config: MarginConfig
): number {
  const notional = size * markPrice;
  return notional * config.maintenanceMarginFraction;
}

/**
 * Calculate unrealized PnL for a position
 */
export function calculateUnrealizedPnl(
  side: "LONG" | "SHORT",
  size: number,
  entryPrice: number,
  markPrice: number
): number {
  if (side === "LONG") {
    return (markPrice - entryPrice) * size;
  } else {
    return (entryPrice - markPrice) * size;
  }
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  side: "LONG" | "SHORT",
  entryPrice: number,
  leverage: number,
  config: MarginConfig
): number {
  const marginFraction = 1 / leverage;
  const maintenanceFraction = config.maintenanceMarginFraction;

  if (side === "LONG") {
    // Liq price = entry * (1 - (1/leverage) + maintenance)
    return entryPrice * (1 - marginFraction + maintenanceFraction);
  } else {
    // Liq price = entry * (1 + (1/leverage) - maintenance)
    return entryPrice * (1 + marginFraction - maintenanceFraction);
  }
}

/**
 * Calculate the PnL percentage (ROE - Return on Equity)
 */
export function calculateROE(
  unrealizedPnl: number,
  margin: number
): number {
  if (margin === 0) return 0;
  return (unrealizedPnl / margin) * 100;
}

// ─── Position Health Checks ────────────────────────────────────

export type PositionHealth = "healthy" | "pre_liquidation" | "liquidation" | "bankrupt";

/**
 * Check the health status of a position
 */
export function checkPositionHealth(
  position: PositionState,
  markPrice: number,
  config: MarginConfig
): { health: PositionHealth; accountValue: number; maintenanceMargin: number } {
  const unrealizedPnl = calculateUnrealizedPnl(
    position.side,
    position.size,
    position.entryPrice,
    markPrice
  );

  const accountValue = position.margin + unrealizedPnl;
  const notional = position.size * markPrice;
  const initialMarginReq = notional * config.initialMarginFraction;
  const maintenanceMarginReq = notional * config.maintenanceMarginFraction;
  const closeOutMarginReq = notional * config.closeOutMarginFraction;

  if (accountValue <= 0) {
    return { health: "bankrupt", accountValue, maintenanceMargin: maintenanceMarginReq };
  }

  if (accountValue < closeOutMarginReq) {
    return { health: "liquidation", accountValue, maintenanceMargin: maintenanceMarginReq };
  }

  if (accountValue < maintenanceMarginReq) {
    return { health: "liquidation", accountValue, maintenanceMargin: maintenanceMarginReq };
  }

  if (accountValue < initialMarginReq) {
    return { health: "pre_liquidation", accountValue, maintenanceMargin: maintenanceMarginReq };
  }

  return { health: "healthy", accountValue, maintenanceMargin: maintenanceMarginReq };
}

/**
 * Check if a new order can be placed given current margin
 */
export function canPlaceOrder(
  account: AccountState,
  orderSize: number,
  orderPrice: number,
  leverage: number
): { allowed: boolean; reason?: string } {
  const requiredMargin = calculateInitialMargin(orderSize, orderPrice, leverage);

  if (requiredMargin > account.availableBalance) {
    return {
      allowed: false,
      reason: `Insufficient margin. Required: $${requiredMargin.toFixed(2)}, Available: $${account.availableBalance.toFixed(2)}`,
    };
  }

  return { allowed: true };
}

// ─── Liquidation Engine ────────────────────────────────────────

export interface LiquidationEvent {
  userId: string;
  marketId: string;
  positionSide: "LONG" | "SHORT";
  positionSize: number;
  entryPrice: number;
  liquidationPrice: number;
  markPrice: number;
  type: "partial" | "full" | "adl";
  feeToLLP: number;
  timestamp: number;
}

/**
 * Process liquidation for a position
 * 
 * Pulse's liquidation flow:
 * 1. Cancel all open orders for the user
 * 2. Send IOC orders at "zero price" to close positions
 * 3. If filled better than zero price, up to 1% fee goes to LLP
 * 4. If LLP can't absorb, trigger ADL against opposite-side positions
 */
export function processLiquidation(
  position: PositionState,
  markPrice: number,
  config: MarginConfig
): LiquidationEvent {
  const unrealizedPnl = calculateUnrealizedPnl(
    position.side,
    position.size,
    position.entryPrice,
    markPrice
  );
  const accountValue = position.margin + unrealizedPnl;
  const notional = position.size * markPrice;
  const closeOutReq = notional * config.closeOutMarginFraction;

  // Determine liquidation type
  let type: "partial" | "full" | "adl" = "partial";
  if (accountValue <= closeOutReq) {
    type = "full";
  }
  if (accountValue <= 0) {
    type = "adl";
  }

  // LLP fee: up to 1% of position notional value
  const feeToLLP = Math.max(0, Math.min(accountValue * 0.01, notional * 0.01));

  return {
    userId: position.userId,
    marketId: position.marketId,
    positionSide: position.side,
    positionSize: position.size,
    entryPrice: position.entryPrice,
    liquidationPrice: calculateLiquidationPrice(
      position.side,
      position.entryPrice,
      position.leverage,
      config
    ),
    markPrice,
    type,
    feeToLLP,
    timestamp: Date.now(),
  };
}

// ─── Funding Rate ──────────────────────────────────────────────

/**
 * Calculate funding rate for a perpetual market
 * 
 * Funding = (Mark Price - Index Price) / Index Price
 * Clamped to [-0.75%, +0.75%] per period
 * Applied hourly
 */
export function calculateFundingRate(
  markPrice: number,
  indexPrice: number,
  dampening: number = 0.0005 // 0.05% dampening factor
): number {
  if (indexPrice === 0) return 0;

  const premium = (markPrice - indexPrice) / indexPrice;
  const fundingRate = premium; // Simplified: premium / funding interval

  // Clamp to [-0.75%, +0.75%]
  const maxRate = 0.0075;
  return Math.max(-maxRate, Math.min(maxRate, fundingRate));
}

/**
 * Calculate funding payment for a position
 * 
 * If funding rate > 0: longs pay shorts
 * If funding rate < 0: shorts pay longs
 */
export function calculateFundingPayment(
  position: PositionState,
  markPrice: number,
  fundingRate: number
): number {
  const notional = position.size * markPrice;
  const payment = notional * fundingRate;

  // Longs pay positive funding, shorts receive
  if (position.side === "LONG") {
    return -payment; // negative = paying
  } else {
    return payment; // positive = receiving
  }
}

// ─── Fair Price Marking ────────────────────────────────────────

/**
 * Calculate mark price using index price + EMA of basis
 * This prevents manipulation of liquidation prices
 */
export function calculateMarkPrice(
  lastTradePrice: number,
  indexPrice: number,
  emaBasis: number = 0 // EMA of (last trade - index)
): number {
  // Mark Price = Index Price + EMA(Last Trade - Index)
  const basis = lastTradePrice - indexPrice;
  const newEmaBasis = emaBasis * 0.99 + basis * 0.01; // Simple EMA
  return indexPrice + newEmaBasis;
}
