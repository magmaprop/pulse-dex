"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useMarketStore, useOrderBookStore, useAccountStore } from "@/lib/stores";
import type { OrderBookLevel, Trade } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001";
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]; // Exponential backoff

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface WSMessage {
  type: string;
  channel?: string;
  data?: any;
  timestamp?: number;
  message?: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [latency, setLatency] = useState<number>(0);

  const { setOrderBook, addTrade } = useOrderBookStore();
  const { setPositions, setOpenOrders } = useAccountStore();

  // ─── Message Handler ─────────────────────────────────────────

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "connected":
            setStatus("connected");
            reconnectAttemptRef.current = 0;
            // Resubscribe to previously subscribed channels
            if (subscribedChannelsRef.current.size > 0) {
              const channels = Array.from(subscribedChannelsRef.current);
              wsRef.current?.send(
                JSON.stringify({ type: "subscribe", channels })
              );
            }
            break;

          case "orderbook":
            if (msg.data) {
              const asks: OrderBookLevel[] = (msg.data.asks || []).map(
                (a: any) => ({
                  price: a.price,
                  size: a.size || a.totalSize,
                  total: 0,
                })
              );
              const bids: OrderBookLevel[] = (msg.data.bids || []).map(
                (b: any) => ({
                  price: b.price,
                  size: b.size || b.totalSize,
                  total: 0,
                })
              );

              // Calculate running totals
              let askTotal = 0;
              asks.forEach((a) => {
                askTotal += a.size;
                a.total = askTotal;
              });
              let bidTotal = 0;
              bids.forEach((b) => {
                bidTotal += b.size;
                b.total = bidTotal;
              });

              const spread =
                asks.length > 0 && bids.length > 0
                  ? asks[0].price - bids[0].price
                  : 0;
              const spreadPct =
                asks.length > 0 && asks[0].price > 0
                  ? (spread / asks[0].price) * 100
                  : 0;

              setOrderBook({
                asks,
                bids,
                spread,
                spreadPercentage: spreadPct,
                lastUpdateId: msg.data.lastUpdateId || Date.now(),
              });
            }
            break;

          case "trade":
            if (msg.data) {
              const trade: Trade = {
                id: msg.data.id || `t_${Date.now()}`,
                marketId: msg.data.marketId || "",
                price: msg.data.price,
                size: msg.data.size,
                side: msg.data.side,
                timestamp: msg.data.timestamp || Date.now(),
              };
              addTrade(trade);
            }
            break;

          case "ticker":
            if (msg.data) {
              const { symbol, price } = msg.data;
              if (symbol && price) {
                useMarketStore.getState().updateMarketPrice(symbol, price);
              }
            }
            break;

          case "order:fill":
          case "order:update":
            // Refresh positions and orders from API when order state changes
            // This triggers a re-fetch in the relevant components
            break;

          case "position:update":
            if (msg.data?.positions) {
              setPositions(msg.data.positions);
            }
            break;

          case "account:update":
            if (msg.data?.orders) {
              setOpenOrders(msg.data.orders);
            }
            break;

          case "pong":
            if (msg.timestamp) {
              setLatency(Date.now() - msg.timestamp);
            }
            break;

          case "error":
            console.error("[WS] Server error:", msg.message);
            break;
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    },
    [setOrderBook, addTrade, setPositions, setOpenOrders]
  );

  // ─── Connect ─────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setStatus("connecting");

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to", WS_URL);
        setStatus("connected");
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log("[WS] Disconnected:", event.code, event.reason);
        setStatus("disconnected");
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        const delay =
          RECONNECT_DELAYS[
            Math.min(
              reconnectAttemptRef.current,
              RECONNECT_DELAYS.length - 1
            )
          ];
        reconnectAttemptRef.current++;

        console.log(
          `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`
        );
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        setStatus("error");
      };
    } catch (err) {
      console.error("[WS] Connection failed:", err);
      setStatus("error");
    }
  }, [handleMessage]);

  // ─── Subscribe / Unsubscribe ─────────────────────────────────

  const subscribe = useCallback((channels: string | string[]) => {
    const channelList = Array.isArray(channels) ? channels : [channels];
    channelList.forEach((c) => subscribedChannelsRef.current.add(c));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "subscribe", channels: channelList })
      );
    }
  }, []);

  const unsubscribe = useCallback((channels: string | string[]) => {
    const channelList = Array.isArray(channels) ? channels : [channels];
    channelList.forEach((c) => subscribedChannelsRef.current.delete(c));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "unsubscribe", channels: channelList })
      );
    }
  }, []);

  // ─── Auth ────────────────────────────────────────────────────

  const authenticate = useCallback((userId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "auth", userId }));
    }
  }, []);

  // ─── Ping ────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "ping", timestamp: Date.now() })
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    status,
    latency,
    subscribe,
    unsubscribe,
    authenticate,
    isConnected: status === "connected",
  };
}

/**
 * Hook that subscribes to a specific market's orderbook and trades
 * when the market changes. Cleans up old subscriptions.
 */
export function useMarketSubscription(marketId: string | undefined) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const prevMarketRef = useRef<string>();

  useEffect(() => {
    if (!marketId || !isConnected) return;

    // Unsubscribe from previous market
    if (prevMarketRef.current && prevMarketRef.current !== marketId) {
      unsubscribe([
        `orderbook:${prevMarketRef.current}`,
        `trades:${prevMarketRef.current}`,
        `ticker:${prevMarketRef.current}`,
      ]);
    }

    // Subscribe to new market
    subscribe([
      `orderbook:${marketId}`,
      `trades:${marketId}`,
      `ticker:${marketId}`,
    ]);

    prevMarketRef.current = marketId;

    return () => {
      unsubscribe([
        `orderbook:${marketId}`,
        `trades:${marketId}`,
        `ticker:${marketId}`,
      ]);
    };
  }, [marketId, isConnected, subscribe, unsubscribe]);
}
