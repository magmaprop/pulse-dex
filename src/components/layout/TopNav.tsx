"use client";

import { useUIStore, useMarketStore } from "@/lib/stores";
import { WalletButton } from "@/components/wallet/WalletButton";
import { formatPrice, formatUSD, formatFundingRate, cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "trade" as const, label: "Trade" },
  { id: "portfolio" as const, label: "Portfolio" },
  { id: "earn" as const, label: "Earn" },
  { id: "leaderboard" as const, label: "Leaderboard" },
];

export function TopNav() {
  const { currentPage, setCurrentPage } = useUIStore();
  const selectedMarket = useMarketStore((s) => s.selectedMarket);

  return (
    <nav className="flex items-center px-4 h-12 border-b border-border-subtle bg-bg-secondary shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6 cursor-pointer" onClick={() => setCurrentPage("trade")}>
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand to-emerald-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#08090c">
            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
          </svg>
        </div>
        <span className="text-[15px] font-bold font-display tracking-tight text-txt-primary">
          Pulse
        </span>
      </div>

      {/* Market info (only on trade page) */}
      {currentPage === "trade" && selectedMarket && (
        <div className="flex items-center gap-1 mr-4">
          <span className="text-sm font-bold font-display text-txt-primary">
            {selectedMarket.symbol}
          </span>
          <span
            className={cn(
              "text-sm font-semibold font-mono ml-2",
              selectedMarket.price > 0
                ? selectedMarket.change24h >= 0
                  ? "text-long"
                  : "text-short"
                : "text-txt-tertiary"
            )}
          >
            {selectedMarket.price > 0
              ? formatPrice(selectedMarket.price)
              : "Loading..."}
          </span>

          {/* Market stats */}
          {selectedMarket.price > 0 && (
            <div className="hidden lg:flex items-center ml-4 gap-0">
              {[
                {
                  label: "24h Change",
                  value:
                    selectedMarket.change24h !== 0
                      ? `${selectedMarket.change24h >= 0 ? "+" : ""}${selectedMarket.change24h.toFixed(2)}%`
                      : "—",
                  color:
                    selectedMarket.change24h >= 0
                      ? "text-long"
                      : "text-short",
                },
                {
                  label: "Funding",
                  value: formatFundingRate(selectedMarket.fundingRate),
                  color:
                    selectedMarket.fundingRate >= 0
                      ? "text-long"
                      : "text-short",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="px-3 border-l border-border-subtle"
                >
                  <div className="text-[9px] text-txt-tertiary font-mono uppercase tracking-wider">
                    {stat.label}
                  </div>
                  <div className={cn("text-[11px] font-mono font-medium", stat.color)}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-1 ml-auto mr-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-sans transition-all",
              currentPage === item.id
                ? "bg-bg-active text-txt-primary font-semibold"
                : "text-txt-tertiary hover:text-txt-secondary hover:bg-bg-hover"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Wallet */}
      <WalletButton />
    </nav>
  );
}
