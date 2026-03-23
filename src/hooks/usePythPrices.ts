"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PYTH_FEED_IDS } from "@/config/markets";
import type { PriceFeed } from "@/types";

const HERMES_URL =
  process.env.NEXT_PUBLIC_PYTH_HERMES_URL || "https://hermes.pyth.network";

/**
 * Hook to subscribe to real-time Pyth price feeds via SSE (Server-Sent Events)
 * This uses Pyth's Hermes API - no API key needed for the public endpoint
 */
export function usePythPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceFeed>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // Get feed IDs for requested symbols
    const feedIds = symbols
      .map((s) => PYTH_FEED_IDS[s])
      .filter(Boolean);

    if (feedIds.length === 0) return;

    // Build SSE URL for streaming prices
    const params = new URLSearchParams();
    feedIds.forEach((id) => params.append("ids[]", id));
    params.append("parsed", "true");
    params.append("allow_unordered", "true");

    const url = `${HERMES_URL}/v2/updates/price/stream?${params.toString()}`;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.parsed) {
          const newPrices: Record<string, PriceFeed> = {};

          data.parsed.forEach((feed: any) => {
            const feedId = "0x" + feed.id;
            // Find symbol for this feed ID
            const symbol = Object.entries(PYTH_FEED_IDS).find(
              ([, id]) => id === feedId
            )?.[0];

            if (symbol && feed.price) {
              const price =
                Number(feed.price.price) * Math.pow(10, feed.price.expo);
              const confidence =
                Number(feed.price.conf) * Math.pow(10, feed.price.expo);

              newPrices[symbol] = {
                id: feedId,
                symbol,
                price,
                confidence,
                expo: feed.price.expo,
                publishTime: feed.price.publish_time,
              };
            }
          });

          setPrices((prev) => ({ ...prev, ...newPrices }));
        }
      } catch (err) {
        console.error("Failed to parse Pyth SSE message:", err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Price feed disconnected. Reconnecting...");

      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connect();
        }
      }, 3000);
    };
  }, [symbols]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { prices, connected, error };
}

/**
 * Hook to fetch a single price snapshot from Pyth (REST API)
 * Useful for one-off price checks (e.g., order validation)
 */
export async function fetchPythPrice(symbol: string): Promise<number | null> {
  const feedId = PYTH_FEED_IDS[symbol];
  if (!feedId) return null;

  try {
    const res = await fetch(
      `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`
    );
    const data = await res.json();

    if (data.parsed?.[0]?.price) {
      const feed = data.parsed[0];
      return Number(feed.price.price) * Math.pow(10, feed.price.expo);
    }
    return null;
  } catch {
    return null;
  }
}
