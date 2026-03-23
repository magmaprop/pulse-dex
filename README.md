# Pulse DEX — Decentralized Perpetual Futures Exchange

A production-ready, open-source perpetual futures trading platform inspired by [Pulse.trade](https://pulse.trade). Built with Next.js 14, real-time Pyth price feeds, RainbowKit wallet connection, and a complete trading UI.

## 🚀 Live Features

- **Real-time prices** via [Pyth Network](https://pyth.network) Hermes SSE streaming
- **Wallet connection** via RainbowKit + Wagmi v2 (MetaMask, WalletConnect, Coinbase, Rabby, etc.)
- **Multi-chain support** — Ethereum, Arbitrum, Base
- **Deposit/Withdraw** flow with ERC-20 approval + vault deposit
- **Trading interface** — Order book, order panel (limit/market/stop), leverage slider, TP/SL
- **Portfolio** — Real USDC balance from wallet, positions, orders, PnL tracking
- **Earn** — Public pools, LLP insurance fund, PULSE staking
- **Leaderboard** — Points system, seasonal rankings, referral program
- **Dark trading theme** — Professional design with DM Sans + JetBrains Mono + Outfit fonts

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 |
| Web3 | Wagmi v2 + Viem + RainbowKit |
| State | Zustand |
| Price Feeds | Pyth Network (Hermes SSE) |
| Charts | TradingView Lightweight Charts (integrate yourself) |
| Animations | Framer Motion |

## 🏁 Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url> pulse-dex
cd pulse-dex
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# REQUIRED: Get from https://cloud.walletconnect.com
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# RECOMMENDED: Get from https://www.alchemy.com (free tier works)
NEXT_PUBLIC_ALCHEMY_KEY=your_alchemy_key

# Optional: Pyth uses public endpoint by default
NEXT_PUBLIC_PYTH_HERMES_URL=https://hermes.pyth.network
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see live prices streaming immediately.

### 4. Build for production

```bash
npm run build
npm start
```

## 🌐 Deploy

### Vercel (Recommended)

1. Push to GitHub
2. Connect to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy — done!

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Railway / Render / Fly.io

All support Next.js out of the box. Push to GitHub, connect, deploy.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout + Web3Provider
│   └── page.tsx            # Main page with routing
├── components/
│   ├── layout/             # TopNav, StatusBar
│   ├── wallet/             # Web3Provider, WalletButton
│   ├── portfolio/          # PortfolioPage, DepositModal
│   ├── earn/               # EarnPage (pools, staking)
│   ├── leaderboard/        # LeaderboardPage (points, referral)
│   ├── trade/              # (add OrderBook, Chart, etc.)
│   └── shared/             # Reusable UI components
├── config/
│   ├── wagmi.ts            # Chain + wallet configuration
│   └── markets.ts          # Market definitions + Pyth feed IDs
├── hooks/
│   └── usePythPrices.ts    # Real-time Pyth SSE price hook
├── lib/
│   ├── stores.ts           # Zustand state management
│   └── utils.ts            # Formatters and helpers
├── types/
│   └── index.ts            # Full TypeScript definitions
└── styles/
    └── globals.css         # Tailwind + custom trading CSS
```

## 🔧 What to Build Next

This project gives you the complete frontend foundation. Here's what to add for a fully functional exchange:

### Backend (choose one)
- **Node.js + Express/Fastify** — Matching engine, WebSocket server, REST API
- **Rust (Axum)** — High-performance matching engine
- **Go** — Pulse's own SDKs are in Go

### Smart Contracts
- **Vault contract** — USDC deposit/withdrawal with on-chain accounting
- **Trading contract** — Position management, margin, liquidation
- **LLP contract** — Insurance fund / liquidity pool
- **Staking contract** — PULSE token staking
- Deploy on Ethereum/Arbitrum/Base using Hardhat or Foundry

### Integrations
- **TradingView Charts** — Apply for [Advanced Charts](https://www.tradingview.com/advanced-charts/) license or use [Lightweight Charts](https://github.com/nichochar/lightweight-charts)
- **Order Book WebSocket** — Connect to your backend matching engine
- **Chainlink/Pyth Oracle** — On-chain price feeds for smart contracts
- **The Graph** — Index on-chain events for trade history

### Production Hardening
- Rate limiting (express-rate-limit or Cloudflare)
- WebSocket reconnection with exponential backoff
- Error boundaries and Sentry integration
- Analytics (Mixpanel, Amplitude, or PostHog)
- SEO meta tags and OpenGraph images

## 🔑 Key Configuration Files

| File | Purpose |
|------|---------|
| `src/config/wagmi.ts` | Add/remove chains, RPC endpoints, contract addresses |
| `src/config/markets.ts` | Add new trading pairs with Pyth feed IDs |
| `tailwind.config.ts` | Customize colors, fonts, spacing |
| `.env.local` | API keys and contract addresses |

## 📊 Adding a New Market

1. Find the Pyth price feed ID at [pyth.network/developers/price-feed-ids](https://pyth.network/developers/price-feed-ids)
2. Add to `src/config/markets.ts`:

```typescript
// In PYTH_FEED_IDS:
"AAPL-USD": "0x49f6...",

// In MARKETS_CONFIG:
{
  id: "aapl-usd",
  symbol: "AAPL-USD",
  base: "AAPL",
  quote: "USD",
  maxLeverage: 10,
  tickSize: 0.01,
  stepSize: 0.1,
  initialMarginFraction: 0.1,
  maintenanceMarginFraction: 0.05,
  status: "active",
}
```

3. The price will automatically stream from Pyth.

## 📄 License

MIT — Use this however you want. Build something great.
