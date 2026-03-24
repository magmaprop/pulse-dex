"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { TopNav } from "@/components/layout/TopNav";
import { PortfolioPage } from "@/components/portfolio/PortfolioPage";
import { EarnPage } from "@/components/earn/EarnPage";
import { LeaderboardPage } from "@/components/leaderboard/LeaderboardPage";
import { DepositModal } from "@/components/portfolio/DepositModal";
import { WithdrawModal } from "@/components/portfolio/WithdrawModal";
import { TradingChart } from "@/components/trade/TradingChart";
import { useUIStore, useMarketStore, useAccountStore, useOrderBookStore } from "@/lib/stores";
import { usePythPrices } from "@/hooks/usePythPrices";
import { useWebSocket, useMarketSubscription } from "@/hooks/useWebSocket";
import { MARKETS_CONFIG } from "@/config/markets";
import { formatPrice, formatUSD, formatSize, formatTime, cn } from "@/lib/utils";
import * as api from "@/lib/api";
import type { OrderBookLevel } from "@/types";

const ALL_SYMBOLS = MARKETS_CONFIG.map((m) => m.symbol);

export default function Home() {
  const { currentPage } = useUIStore();
  const { isConnected } = useAccount();
  const { markets, selectedMarket, setSelectedMarket, updateMarketPrices } = useMarketStore();
  const { setConnected } = useAccountStore();
  const { prices, connected: priceConnected, error: priceError } = usePythPrices(ALL_SYMBOLS);
  const { status: wsStatus, latency } = useWebSocket();
  useMarketSubscription(selectedMarket?.id);

  useEffect(() => { if (Object.keys(prices).length > 0) updateMarketPrices(prices); }, [prices, updateMarketPrices]);
  useEffect(() => { if (!selectedMarket && markets.length > 0) setSelectedMarket(markets[0]); }, [selectedMarket, markets, setSelectedMarket]);
  useEffect(() => { setConnected(isConnected); }, [isConnected, setConnected]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-bg-primary">
      <TopNav />
      <div className="flex-1 flex overflow-hidden">
        {currentPage === "trade" && <TradePage />}
        {currentPage === "portfolio" && <PortfolioPage />}
        {currentPage === "earn" && <EarnPage />}
        {currentPage === "leaderboard" && <LeaderboardPage />}
      </div>
      <div className="flex items-center justify-between px-4 h-6 border-t border-border-subtle bg-bg-secondary shrink-0 text-[9px] font-mono text-txt-tertiary">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", priceConnected ? "bg-long animate-pulse" : "bg-short")} /><span>Pyth {priceConnected ? "Live" : "..."}</span></div>
          <div className="flex items-center gap-1.5"><div className={cn("w-1.5 h-1.5 rounded-full", wsStatus === "connected" ? "bg-long" : "bg-yellow-500")} /><span>WS {wsStatus}</span></div>
          {latency > 0 && <span>{latency}ms</span>}
        </div>
      </div>
      <DepositModal />
      <WithdrawModal />
    </div>
  );
}

function TradePage() {
  const { markets, selectedMarket, setSelectedMarket } = useMarketStore();
  const { orderbook, recentTrades } = useOrderBookStore();
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle bg-bg-secondary overflow-x-auto shrink-0">
        {markets.map((m) => (
          <button key={m.id} onClick={() => setSelectedMarket(m)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-all", selectedMarket?.id === m.id ? "bg-bg-active border border-border-strong text-txt-primary" : "text-txt-tertiary hover:bg-bg-hover border border-transparent")}>
            <span className="font-semibold font-sans">{m.base}</span>
            <span className={cn("tabular-nums", m.price > 0 ? (m.change24h >= 0 ? "text-long" : "text-short") : "text-txt-disabled")}>{m.price > 0 ? formatPrice(m.price) : "—"}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr_280px] grid-rows-[1fr_200px] overflow-hidden">
        <div className="hidden md:flex row-span-2 border-r border-border-subtle bg-bg-secondary flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center text-center px-4">
            {selectedMarket?.price ? (
              <div><div className="text-lg font-bold font-mono text-long">{formatPrice(selectedMarket.price)}</div><p className="text-[10px] text-txt-tertiary mt-1">Live • Orderbook via backend WS</p></div>
            ) : <p className="text-xs text-txt-tertiary">Loading...</p>}
          </div>
        </div>
        <div className="border-r border-border-subtle overflow-hidden"><TradingChart /></div>
        <div className="hidden md:block row-span-2 bg-bg-secondary overflow-auto text-center pt-8 text-xs text-txt-tertiary">Order panel ready<br/>Connect wallet to trade</div>
        <div className="col-span-1 md:col-span-2 border-t border-border-subtle bg-bg-secondary flex items-center justify-center text-xs text-txt-tertiary">Positions & orders load from API</div>
      </div>
    </div>
  );
}
