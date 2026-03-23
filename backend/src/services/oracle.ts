/**
 * Price Oracle Service
 * 
 * Connects to Pyth Network's Hermes API to stream real-time prices.
 * Used by the risk engine for mark price, liquidation checks, and funding rate calculations.
 */

import { EventEmitter } from "events";

const PYTH_FEED_IDS: Record<string, string> = {
  "BTC-USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH-USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL-USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "ARB-USD": "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  "DOGE-USD": "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  "EUR-USD": "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
};

export interface OraclePrice {
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
}

export class PriceOracle extends EventEmitter {
  private hermesUrl: string;
  private prices: Map<string, OraclePrice> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connected = false;

  constructor(hermesUrl?: string) {
    super();
    this.hermesUrl = hermesUrl || process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
  }

  /**
   * Start streaming prices from Pyth via HTTP polling
   * (SSE/EventSource is browser-only, so we use polling in Node.js)
   */
  async start(symbols: string[] = Object.keys(PYTH_FEED_IDS)) {
    console.log(`[Oracle] Starting price feeds for ${symbols.length} symbols`);
    this.connected = true;

    const feedIds = symbols.map((s) => PYTH_FEED_IDS[s]).filter(Boolean);

    const poll = async () => {
      if (!this.connected) return;

      try {
        const params = new URLSearchParams();
        feedIds.forEach((id) => params.append("ids[]", id));
        params.append("parsed", "true");

        const res = await fetch(
          `${this.hermesUrl}/v2/updates/price/latest?${params.toString()}`
        );

        if (!res.ok) {
          throw new Error(`Hermes API error: ${res.status}`);
        }

        const data = await res.json();

        if (data.parsed) {
          for (const feed of data.parsed) {
            const feedId = "0x" + feed.id;
            const symbol = Object.entries(PYTH_FEED_IDS).find(
              ([, id]) => id === feedId
            )?.[0];

            if (symbol && feed.price) {
              const price =
                Number(feed.price.price) * Math.pow(10, feed.price.expo);
              const confidence =
                Number(feed.price.conf) * Math.pow(10, feed.price.expo);

              const oraclePrice: OraclePrice = {
                symbol,
                price,
                confidence,
                publishTime: feed.price.publish_time,
              };

              this.prices.set(symbol, oraclePrice);
              this.emit("price", oraclePrice);
            }
          }

          this.emit("prices:update", Object.fromEntries(this.prices));
        }
      } catch (err) {
        console.error("[Oracle] Error fetching prices:", err);
        this.emit("error", err);
      }

      // Poll every 400ms (Pyth updates every ~400ms)
      if (this.connected) {
        this.reconnectTimer = setTimeout(poll, 400);
      }
    };

    await poll();
  }

  stop() {
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    console.log("[Oracle] Stopped");
  }

  getPrice(symbol: string): OraclePrice | undefined {
    return this.prices.get(symbol);
  }

  getAllPrices(): Map<string, OraclePrice> {
    return new Map(this.prices);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
