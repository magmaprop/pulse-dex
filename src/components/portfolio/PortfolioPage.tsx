"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { useAccountStore, useUIStore } from "@/lib/stores";
import { formatUSD, formatPrice, formatPercent, formatDate, formatTime, cn, shortenAddress } from "@/lib/utils";
import { USDC_ADDRESSES } from "@/config/wagmi";

export function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { positions, openOrders } = useAccountStore();
  const { setDepositModalOpen, setWithdrawModalOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "orders" | "history" | "transfers">("overview");

  // Fetch real USDC balance on Ethereum mainnet
  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_ADDRESSES[1], // mainnet USDC
    chainId: 1,
  });

  const equity = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)) : 0;
  const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const usedMargin = positions.reduce((s, p) => s + p.margin, 0);
  const availableMargin = equity - usedMargin + totalPnl;

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
              <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1" fill="currentColor"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold font-display text-txt-primary">Connect Your Wallet</h2>
          <p className="text-sm text-txt-tertiary max-w-sm">Connect your Ethereum wallet to view your portfolio, deposit funds, and start trading.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "positions" as const, label: "Positions", count: positions.length },
    { id: "orders" as const, label: "Open Orders", count: openOrders.length },
    { id: "history" as const, label: "Trade History" },
    { id: "transfers" as const, label: "Transfers" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-txt-primary">Portfolio</h1>
          <p className="text-xs text-txt-tertiary font-mono mt-1">{shortenAddress(address || "")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDepositModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary hover:shadow-lg hover:shadow-brand/20 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
            Deposit
          </button>
          <button onClick={() => setWithdrawModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-bg-elevated border border-border-default text-txt-primary hover:border-border-strong transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
            Withdraw
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Equity" value={formatUSD(equity)} icon="💰" />
        <StatCard label="Available Margin" value={formatUSD(availableMargin)} color="text-brand" icon="📊" />
        <StatCard label="Unrealized PnL" value={`${totalPnl >= 0 ? "+" : ""}${formatUSD(totalPnl)}`} color={totalPnl >= 0 ? "text-long" : "text-short"} icon="📈" />
        <StatCard label="Used Margin" value={formatUSD(usedMargin)} icon="🔒" />
      </div>

      {/* Tabs */}
      <div className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
        <div className="flex border-b border-border-subtle px-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn(
                "px-4 py-3 text-xs font-sans transition-all border-b-2",
                activeTab === t.id ? "text-txt-primary font-semibold border-brand" : "text-txt-tertiary border-transparent hover:text-txt-secondary"
              )}>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 text-[9px] bg-bg-active px-1.5 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-[300px]">
          {activeTab === "overview" && (
            <div className="p-6 space-y-6">
              {/* Balance breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-txt-primary mb-3">Balance Breakdown</h3>
                <div className="bg-bg-primary rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-tertiary">Wallet USDC (Mainnet)</span>
                    <span className="text-txt-primary font-mono">{usdcBalance ? formatUnits(usdcBalance.value, 6) : "0.00"} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-tertiary">Trading Balance</span>
                    <span className="text-txt-primary font-mono">{formatUSD(equity)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-tertiary">In Positions (Margin)</span>
                    <span className="text-txt-secondary font-mono">{formatUSD(usedMargin)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-tertiary">In Open Orders</span>
                    <span className="text-txt-secondary font-mono">$0.00</span>
                  </div>
                  <div className="border-t border-border-subtle pt-3 flex justify-between text-xs font-semibold">
                    <span className="text-txt-primary">Total Account Value</span>
                    <span className="text-brand font-mono">{formatUSD(equity + totalPnl)}</span>
                  </div>
                </div>
              </div>

              {/* Active Positions Summary */}
              {positions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-txt-primary mb-3">Active Positions ({positions.length})</h3>
                  <div className="grid gap-2">
                    {positions.map(p => (
                      <div key={p.id} className="bg-bg-primary rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-1 h-8 rounded-full", p.side === "long" ? "bg-long" : "bg-short")} />
                          <div>
                            <div className="text-xs font-semibold text-txt-primary">{p.symbol}</div>
                            <div className={cn("text-[10px] font-mono", p.side === "long" ? "text-long" : "text-short")}>
                              {p.side.toUpperCase()} {p.leverage}x
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-xs font-mono font-semibold", p.unrealizedPnl >= 0 ? "text-long" : "text-short")}>
                            {p.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(p.unrealizedPnl)}
                          </div>
                          <div className={cn("text-[10px] font-mono", p.pnlPercentage >= 0 ? "text-long" : "text-short")}>
                            {formatPercent(p.pnlPercentage)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {positions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-txt-tertiary">No open positions</p>
                  <p className="text-xs text-txt-disabled mt-1">Start trading to see your positions here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "positions" && (
            <PositionsTable positions={positions} />
          )}

          {activeTab === "orders" && (
            <OrdersTable orders={openOrders} />
          )}

          {(activeTab === "history" || activeTab === "transfers") && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-sm text-txt-tertiary">No {activeTab === "history" ? "trade" : "transfer"} history yet</p>
                <p className="text-xs text-txt-disabled mt-1">
                  {activeTab === "history" ? "Execute trades to see your history" : "Make deposits or withdrawals to see transfers"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-txt-primary", icon }: { label: string; value: string; color?: string; icon: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle hover:border-border-default transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] text-txt-tertiary font-sans uppercase tracking-wider">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className={cn("text-lg font-bold font-display", color)}>{value}</div>
    </div>
  );
}

function PositionsTable({ positions }: { positions: any[] }) {
  if (positions.length === 0) return (
    <div className="flex items-center justify-center py-16 text-sm text-txt-tertiary">No open positions</div>
  );
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-[10px] text-txt-tertiary uppercase tracking-wider">
          {["Market", "Side", "Size", "Entry", "Mark", "Liq. Price", "Leverage", "Margin", "PnL (ROE)", ""].map(h => (
            <th key={h} className="text-left px-4 py-3 border-b border-border-subtle font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p: any) => (
          <tr key={p.id} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
            <td className="px-4 py-3 font-semibold text-txt-primary">{p.symbol}</td>
            <td className={cn("px-4 py-3 font-semibold", p.side === "long" ? "text-long" : "text-short")}>{p.side.toUpperCase()}</td>
            <td className="px-4 py-3 text-txt-primary">{p.size}</td>
            <td className="px-4 py-3 text-txt-secondary">{formatPrice(p.entryPrice)}</td>
            <td className="px-4 py-3 text-txt-primary">{formatPrice(p.markPrice)}</td>
            <td className="px-4 py-3 text-yellow-500">{formatPrice(p.liquidationPrice)}</td>
            <td className="px-4 py-3 text-brand">{p.leverage}x</td>
            <td className="px-4 py-3 text-txt-secondary">{formatUSD(p.margin)}</td>
            <td className="px-4 py-3">
              <span className={cn("font-semibold", p.unrealizedPnl >= 0 ? "text-long" : "text-short")}>
                {p.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(p.unrealizedPnl)}
              </span>
              <span className={cn("ml-1 text-[10px]", p.pnlPercentage >= 0 ? "text-long" : "text-short")}>
                ({formatPercent(p.pnlPercentage)})
              </span>
            </td>
            <td className="px-4 py-3">
              <button className="px-2 py-1 text-[10px] font-semibold bg-short/10 text-short border border-short/20 rounded hover:bg-short/20 transition-colors">
                Close
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdersTable({ orders }: { orders: any[] }) {
  if (orders.length === 0) return (
    <div className="flex items-center justify-center py-16 text-sm text-txt-tertiary">No open orders</div>
  );
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-[10px] text-txt-tertiary uppercase tracking-wider">
          {["Market", "Side", "Type", "Price", "Size", "Filled", "Status", "Time", ""].map(h => (
            <th key={h} className="text-left px-4 py-3 border-b border-border-subtle font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((o: any) => (
          <tr key={o.id} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
            <td className="px-4 py-3 font-semibold text-txt-primary">{o.symbol}</td>
            <td className={cn("px-4 py-3 font-semibold", o.side === "buy" ? "text-long" : "text-short")}>{o.side.toUpperCase()}</td>
            <td className="px-4 py-3 text-txt-secondary capitalize">{o.type}</td>
            <td className="px-4 py-3 text-txt-primary">{o.price ? formatPrice(o.price) : "Market"}</td>
            <td className="px-4 py-3 text-txt-primary">{o.size}</td>
            <td className="px-4 py-3 text-txt-tertiary">{o.filledSize}</td>
            <td className="px-4 py-3"><span className="text-[9px] bg-brand/10 text-brand px-2 py-0.5 rounded-full capitalize">{o.status}</span></td>
            <td className="px-4 py-3 text-txt-tertiary">{formatTime(o.createdAt)}</td>
            <td className="px-4 py-3">
              <button className="px-2 py-1 text-[10px] font-semibold bg-short/10 text-short border border-short/20 rounded hover:bg-short/20 transition-colors">
                Cancel
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
