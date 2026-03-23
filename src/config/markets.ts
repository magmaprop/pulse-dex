import type { Market } from "@/types";

// Pyth Network price feed IDs (mainnet stable feeds)
// Full list: https://pyth.network/developers/price-feed-ids
export const PYTH_FEED_IDS: Record<string, string> = {
  "BTC-USD":
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH-USD":
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL-USD":
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "ARB-USD":
    "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  "DOGE-USD":
    "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  "AVAX-USD":
    "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  "MATIC-USD":
    "0x5de33440f6c9e122afd48bef111f907e25ee3bf1d01e4a74add3542cb36dae71",
  "LINK-USD":
    "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  // FX pairs
  "EUR-USD":
    "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  "GBP-USD":
    "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df01ae7",
};

// Market definitions
export const MARKETS_CONFIG: Omit<Market, "price" | "change24h" | "volume24h" | "openInterest" | "fundingRate" | "nextFunding">[] = [
  {
    id: "btc-usd",
    symbol: "BTC-USD",
    base: "BTC",
    quote: "USD",
    maxLeverage: 50,
    tickSize: 0.1,
    stepSize: 0.001,
    initialMarginFraction: 0.02,
    maintenanceMarginFraction: 0.01,
    status: "active",
  },
  {
    id: "eth-usd",
    symbol: "ETH-USD",
    base: "ETH",
    quote: "USD",
    maxLeverage: 50,
    tickSize: 0.01,
    stepSize: 0.01,
    initialMarginFraction: 0.02,
    maintenanceMarginFraction: 0.01,
    status: "active",
  },
  {
    id: "sol-usd",
    symbol: "SOL-USD",
    base: "SOL",
    quote: "USD",
    maxLeverage: 25,
    tickSize: 0.001,
    stepSize: 0.1,
    initialMarginFraction: 0.04,
    maintenanceMarginFraction: 0.02,
    status: "active",
  },
  {
    id: "arb-usd",
    symbol: "ARB-USD",
    base: "ARB",
    quote: "USD",
    maxLeverage: 20,
    tickSize: 0.0001,
    stepSize: 1,
    initialMarginFraction: 0.05,
    maintenanceMarginFraction: 0.025,
    status: "active",
  },
  {
    id: "doge-usd",
    symbol: "DOGE-USD",
    base: "DOGE",
    quote: "USD",
    maxLeverage: 20,
    tickSize: 0.00001,
    stepSize: 10,
    initialMarginFraction: 0.05,
    maintenanceMarginFraction: 0.025,
    status: "active",
  },
  {
    id: "eur-usd",
    symbol: "EUR-USD",
    base: "EUR",
    quote: "USD",
    maxLeverage: 25,
    tickSize: 0.00001,
    stepSize: 100,
    initialMarginFraction: 0.04,
    maintenanceMarginFraction: 0.02,
    status: "active",
  },
];
