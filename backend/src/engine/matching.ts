/**
 * Price-Time Priority Matching Engine
 * 
 * This is the core of the exchange. It maintains an in-memory order book
 * and matches incoming orders using price-time priority (FIFO at each price level).
 * 
 * Architecture:
 * - Orders are stored in a sorted map (price → queue of orders)
 * - Bids sorted descending (best bid = highest price)
 * - Asks sorted ascending (best ask = lowest price)
 * - Each price level is a FIFO queue (time priority)
 * - Trade events are emitted for downstream processing
 */

import { EventEmitter } from "events";

// ─── Types ─────────────────────────────────────────────────────

export type Side = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP_MARKET" | "STOP_LIMIT";
export type TimeInForce = "GTC" | "IOC" | "FOK";
export type OrderStatus = "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED";

export interface EngineOrder {
  id: string;
  userId: string;
  marketId: string;
  side: Side;
  type: OrderType;
  price: number; // 0 for market orders
  triggerPrice?: number;
  size: number;
  remainingSize: number;
  filledSize: number;
  avgFillPrice: number;
  timeInForce: TimeInForce;
  postOnly: boolean;
  reduceOnly: boolean;
  status: OrderStatus;
  timestamp: number;
}

export interface MatchResult {
  trades: EngineTradeEvent[];
  makerOrder: EngineOrder;
  takerOrder: EngineOrder;
}

export interface EngineTradeEvent {
  id: string;
  marketId: string;
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  price: number;
  size: number;
  takerSide: Side;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  lastUpdateId: number;
}

// ─── Price Level (FIFO queue at a single price) ────────────────

class PriceLevel {
  price: number;
  orders: EngineOrder[] = [];
  totalSize: number = 0;

  constructor(price: number) {
    this.price = price;
  }

  add(order: EngineOrder) {
    this.orders.push(order);
    this.totalSize += order.remainingSize;
  }

  remove(orderId: string): EngineOrder | undefined {
    const idx = this.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return undefined;
    const order = this.orders.splice(idx, 1)[0];
    this.totalSize -= order.remainingSize;
    return order;
  }

  peek(): EngineOrder | undefined {
    return this.orders[0];
  }

  isEmpty(): boolean {
    return this.orders.length === 0;
  }

  fill(size: number): number {
    this.totalSize -= size;
    return this.totalSize;
  }
}

// ─── Order Book (one side: bids or asks) ───────────────────────

class OrderBookSide {
  private levels: Map<number, PriceLevel> = new Map();
  private sortedPrices: number[] = [];
  private isBidSide: boolean;

  constructor(isBidSide: boolean) {
    this.isBidSide = isBidSide;
  }

  add(order: EngineOrder) {
    let level = this.levels.get(order.price);
    if (!level) {
      level = new PriceLevel(order.price);
      this.levels.set(order.price, level);
      this.insertSorted(order.price);
    }
    level.add(order);
  }

  remove(orderId: string, price: number): EngineOrder | undefined {
    const level = this.levels.get(price);
    if (!level) return undefined;
    const order = level.remove(orderId);
    if (level.isEmpty()) {
      this.levels.delete(price);
      this.sortedPrices = this.sortedPrices.filter((p) => p !== price);
    }
    return order;
  }

  bestPrice(): number | undefined {
    return this.sortedPrices[0];
  }

  bestLevel(): PriceLevel | undefined {
    const price = this.bestPrice();
    return price !== undefined ? this.levels.get(price) : undefined;
  }

  getSnapshot(depth: number): OrderBookLevel[] {
    return this.sortedPrices.slice(0, depth).map((price) => {
      const level = this.levels.get(price)!;
      return {
        price,
        size: level.totalSize,
        orderCount: level.orders.length,
      };
    });
  }

  get size(): number {
    return this.sortedPrices.length;
  }

  private insertSorted(price: number) {
    // Binary search for insertion point
    let lo = 0,
      hi = this.sortedPrices.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = this.isBidSide
        ? this.sortedPrices[mid] > price // bids: descending
        : this.sortedPrices[mid] < price; // asks: ascending
      if (cmp) lo = mid + 1;
      else hi = mid;
    }
    this.sortedPrices.splice(lo, 0, price);
  }
}

// ─── Matching Engine ───────────────────────────────────────────

let tradeCounter = 0;

export class MatchingEngine extends EventEmitter {
  private marketId: string;
  private bids: OrderBookSide;
  private asks: OrderBookSide;
  private orders: Map<string, EngineOrder> = new Map();
  private stopOrders: EngineOrder[] = [];
  private lastPrice: number = 0;
  private updateId: number = 0;

  constructor(marketId: string) {
    super();
    this.marketId = marketId;
    this.bids = new OrderBookSide(true); // descending
    this.asks = new OrderBookSide(false); // ascending
  }

  /**
   * Submit a new order to the matching engine
   */
  submitOrder(order: EngineOrder): EngineOrder {
    // Validate
    if (order.size <= 0) throw new Error("Order size must be positive");
    if (order.type === "LIMIT" && order.price <= 0)
      throw new Error("Limit order requires positive price");

    // Handle stop orders — queue them, don't match immediately
    if (order.type === "STOP_MARKET" || order.type === "STOP_LIMIT") {
      this.stopOrders.push(order);
      this.orders.set(order.id, order);
      this.emit("order:new", order);
      return order;
    }

    // Post-only check: reject if it would cross the book
    if (order.postOnly && this.wouldCross(order)) {
      order.status = "CANCELLED";
      this.emit("order:cancelled", order);
      return order;
    }

    // Match the order
    const trades = this.matchOrder(order);

    // If still remaining, add to book (limit orders only)
    if (order.remainingSize > 0) {
      if (order.type === "LIMIT" && order.timeInForce === "GTC") {
        this.addToBook(order);
        order.status = order.filledSize > 0 ? "PARTIAL" : "OPEN";
      } else {
        // IOC: cancel remaining; FOK handled in matchOrder
        order.status = order.filledSize > 0 ? "PARTIAL" : "CANCELLED";
      }
    } else {
      order.status = "FILLED";
    }

    this.orders.set(order.id, order);
    this.emit("order:new", order);

    // Emit trades
    for (const trade of trades) {
      this.lastPrice = trade.price;
      this.emit("trade", trade);
    }

    // Check stop orders after price change
    if (trades.length > 0) {
      this.checkStopOrders();
    }

    this.updateId++;
    this.emit("orderbook:update", this.getSnapshot(20));

    return order;
  }

  /**
   * Cancel an existing order
   */
  cancelOrder(orderId: string): EngineOrder | undefined {
    const order = this.orders.get(orderId);
    if (!order || order.status === "FILLED" || order.status === "CANCELLED") {
      return undefined;
    }

    // Remove from stop orders
    if (order.type === "STOP_MARKET" || order.type === "STOP_LIMIT") {
      this.stopOrders = this.stopOrders.filter((o) => o.id !== orderId);
    } else {
      // Remove from order book
      const side = order.side === "BUY" ? this.bids : this.asks;
      side.remove(orderId, order.price);
    }

    order.status = "CANCELLED";
    this.orders.set(orderId, order);
    this.updateId++;
    this.emit("order:cancelled", order);
    this.emit("orderbook:update", this.getSnapshot(20));

    return order;
  }

  /**
   * Get current order book snapshot
   */
  getSnapshot(depth: number = 20): OrderBookSnapshot {
    return {
      asks: this.asks.getSnapshot(depth),
      bids: this.bids.getSnapshot(depth),
      lastUpdateId: this.updateId,
    };
  }

  /**
   * Get spread info
   */
  getSpread(): { bid: number; ask: number; spread: number; mid: number } | null {
    const bid = this.bids.bestPrice();
    const ask = this.asks.bestPrice();
    if (bid === undefined || ask === undefined) return null;
    return {
      bid,
      ask,
      spread: ask - bid,
      mid: (bid + ask) / 2,
    };
  }

  getLastPrice(): number {
    return this.lastPrice;
  }

  getOrder(orderId: string): EngineOrder | undefined {
    return this.orders.get(orderId);
  }

  // ─── Private Methods ────────────────────────────────────────

  private matchOrder(taker: EngineOrder): EngineTradeEvent[] {
    const trades: EngineTradeEvent[] = [];
    const oppositeSide = taker.side === "BUY" ? this.asks : this.bids;

    // FOK: check if entire order can be filled
    if (taker.timeInForce === "FOK") {
      if (!this.canFillEntirely(taker)) {
        taker.status = "CANCELLED";
        return trades;
      }
    }

    while (taker.remainingSize > 0) {
      const bestLevel = oppositeSide.bestLevel();
      if (!bestLevel) break;

      const maker = bestLevel.peek();
      if (!maker) break;

      // Price check
      if (taker.type === "LIMIT") {
        if (taker.side === "BUY" && taker.price < maker.price) break;
        if (taker.side === "SELL" && taker.price > maker.price) break;
      }

      // Self-trade prevention
      if (taker.userId === maker.userId) {
        // Cancel the resting (maker) order
        oppositeSide.remove(maker.id, maker.price);
        maker.status = "CANCELLED";
        this.orders.set(maker.id, maker);
        this.emit("order:cancelled", maker);
        continue;
      }

      // Execute match
      const matchSize = Math.min(taker.remainingSize, maker.remainingSize);
      const matchPrice = maker.price; // Price-time priority: maker's price

      // Update taker
      taker.filledSize += matchSize;
      taker.remainingSize -= matchSize;
      taker.avgFillPrice =
        (taker.avgFillPrice * (taker.filledSize - matchSize) +
          matchPrice * matchSize) /
        taker.filledSize;

      // Update maker
      maker.filledSize += matchSize;
      maker.remainingSize -= matchSize;
      maker.avgFillPrice =
        (maker.avgFillPrice * (maker.filledSize - matchSize) +
          matchPrice * matchSize) /
        maker.filledSize;
      bestLevel.fill(matchSize);

      // Remove maker if fully filled
      if (maker.remainingSize <= 0) {
        oppositeSide.remove(maker.id, maker.price);
        maker.status = "FILLED";
      } else {
        maker.status = "PARTIAL";
      }
      this.orders.set(maker.id, maker);
      this.emit("order:updated", maker);

      // Create trade event
      const trade: EngineTradeEvent = {
        id: `t_${++tradeCounter}_${Date.now()}`,
        marketId: this.marketId,
        makerOrderId: maker.id,
        takerOrderId: taker.id,
        makerUserId: maker.userId,
        takerUserId: taker.userId,
        price: matchPrice,
        size: matchSize,
        takerSide: taker.side,
        timestamp: Date.now(),
      };

      trades.push(trade);
    }

    return trades;
  }

  private addToBook(order: EngineOrder) {
    const side = order.side === "BUY" ? this.bids : this.asks;
    side.add(order);
  }

  private wouldCross(order: EngineOrder): boolean {
    if (order.side === "BUY") {
      const bestAsk = this.asks.bestPrice();
      return bestAsk !== undefined && order.price >= bestAsk;
    } else {
      const bestBid = this.bids.bestPrice();
      return bestBid !== undefined && order.price <= bestBid;
    }
  }

  private canFillEntirely(order: EngineOrder): boolean {
    const snapshot =
      order.side === "BUY"
        ? this.asks.getSnapshot(100)
        : this.bids.getSnapshot(100);
    let remaining = order.size;
    for (const level of snapshot) {
      if (order.type === "LIMIT") {
        if (order.side === "BUY" && order.price < level.price) break;
        if (order.side === "SELL" && order.price > level.price) break;
      }
      remaining -= level.size;
      if (remaining <= 0) return true;
    }
    return false;
  }

  private checkStopOrders() {
    const triggered: EngineOrder[] = [];
    this.stopOrders = this.stopOrders.filter((order) => {
      const trigger = order.triggerPrice!;
      const shouldTrigger =
        (order.side === "BUY" && this.lastPrice >= trigger) ||
        (order.side === "SELL" && this.lastPrice <= trigger);

      if (shouldTrigger) {
        triggered.push(order);
        return false;
      }
      return true;
    });

    // Convert stop orders to market/limit and submit
    for (const order of triggered) {
      order.type = order.type === "STOP_MARKET" ? "MARKET" : "LIMIT";
      order.timestamp = Date.now();
      this.submitOrder(order);
    }
  }
}

// ─── Engine Manager (multiple markets) ─────────────────────────

export class EngineManager {
  private engines: Map<string, MatchingEngine> = new Map();

  getOrCreate(marketId: string): MatchingEngine {
    let engine = this.engines.get(marketId);
    if (!engine) {
      engine = new MatchingEngine(marketId);
      this.engines.set(marketId, engine);
    }
    return engine;
  }

  get(marketId: string): MatchingEngine | undefined {
    return this.engines.get(marketId);
  }

  getAll(): Map<string, MatchingEngine> {
    return this.engines;
  }
}
