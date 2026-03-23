"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useEarnStore } from "@/lib/stores";
import { formatUSD, formatPercent, cn } from "@/lib/utils";

export function EarnPage() {
  const { isConnected } = useAccount();
  const { pools, staking } = useEarnStore();
  const [activeTab, setActiveTab] = useState<"pools" | "staking">("pools");
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  const tabs = [
    { id: "pools" as const, label: "Public Pools & LLP" },
    { id: "staking" as const, label: "PULSE Staking" },
  ];

  const riskColors: Record<string, string> = {
    low: "text-long bg-long/10 border-long/20",
    medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    high: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    very_high: "text-short bg-short/10 border-short/20",
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-display text-txt-primary">Earn</h1>
        <p className="text-sm text-txt-tertiary mt-1">Provide liquidity, stake PULSE, and earn yield on your assets.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-bg-secondary rounded-lg p-5 border border-border-subtle">
          <div className="text-[10px] text-txt-tertiary uppercase tracking-wider mb-1">Total Value Deposited</div>
          <div className="text-2xl font-bold font-display text-txt-primary">
            {formatUSD(pools.reduce((s, p) => s + p.userValue, 0) + (staking?.userStake || 0) * (staking?.tokenPrice || 0))}
          </div>
          <div className="text-xs text-txt-tertiary mt-1">Across all pools & staking</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-5 border border-border-subtle">
          <div className="text-[10px] text-txt-tertiary uppercase tracking-wider mb-1">Total TVL (All Pools)</div>
          <div className="text-2xl font-bold font-display text-txt-primary">
            {formatUSD(pools.reduce((s, p) => s + p.tvl, 0))}
          </div>
          <div className="text-xs text-txt-tertiary mt-1">{pools.length} active pools</div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-5 border border-border-subtle">
          <div className="text-[10px] text-txt-tertiary uppercase tracking-wider mb-1">PULSE Staking APY</div>
          <div className="text-2xl font-bold font-display text-brand">
            {staking ? `${staking.apy.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-txt-tertiary mt-1">
            {staking ? `${formatUSD(staking.totalStaked * staking.tokenPrice)} total staked` : "Loading..."}
          </div>
        </div>
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
            </button>
          ))}
        </div>

        {activeTab === "pools" && (
          <div className="p-4 space-y-3">
            {pools.length === 0 ? (
              <div className="text-center py-12 text-sm text-txt-tertiary">
                <p>No pools available yet.</p>
                <p className="text-xs text-txt-disabled mt-1">Pools will appear here once the contracts are deployed.</p>
              </div>
            ) : (
              pools.map(pool => (
                <div key={pool.id}
                  className={cn(
                    "bg-bg-primary rounded-lg border transition-all cursor-pointer",
                    selectedPool === pool.id ? "border-brand/30" : "border-border-subtle hover:border-border-default"
                  )}
                  onClick={() => setSelectedPool(selectedPool === pool.id ? null : pool.id)}>
                  {/* Pool header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                        pool.name.includes("LLP") ? "bg-brand/10" : "bg-bg-elevated"
                      )}>
                        {pool.name.includes("LLP") ? "🛡️" : pool.name.includes("Alpha") ? "🚀" : pool.name.includes("Delta") ? "⚖️" : "🎲"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-txt-primary flex items-center gap-2">
                          {pool.name}
                          {pool.name.includes("LLP") && (
                            <span className="text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full border border-brand/20 font-mono">OFFICIAL</span>
                          )}
                        </div>
                        <div className="text-[10px] text-txt-tertiary mt-0.5">{pool.description}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[10px] text-txt-tertiary">TVL</div>
                        <div className="text-sm font-mono font-semibold text-txt-primary">{formatUSD(pool.tvl)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-txt-tertiary">APY</div>
                        <div className="text-sm font-mono font-bold text-long">{pool.apy.toFixed(1)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-txt-tertiary">Risk</div>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize", riskColors[pool.riskLevel])}>
                          {pool.riskLevel.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <div className="text-[10px] text-txt-tertiary">Your Value</div>
                        <div className="text-sm font-mono font-semibold text-txt-primary">
                          {pool.userValue > 0 ? formatUSD(pool.userValue) : "—"}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={cn("text-txt-tertiary transition-transform", selectedPool === pool.id && "rotate-180")}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Expanded deposit section */}
                  {selectedPool === pool.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-border-subtle mt-0">
                      <div className="pt-4 grid grid-cols-2 gap-4">
                        {/* Deposit */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-txt-primary">Deposit</h4>
                          <div className="flex items-center bg-bg-tertiary border border-border-default rounded-lg overflow-hidden">
                            <input type="text" value={depositAmount} onChange={e => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                              placeholder="0.00" className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-sm px-3 py-2.5"/>
                            <span className="pr-3 text-xs text-txt-tertiary font-mono">USDC</span>
                          </div>
                          <button disabled={!isConnected} className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary disabled:opacity-40 transition-all hover:shadow-brand/20 hover:shadow-lg">
                            {isConnected ? "Deposit to Pool" : "Connect Wallet"}
                          </button>
                        </div>
                        {/* Withdraw */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-txt-primary">Withdraw</h4>
                          <div className="flex items-center bg-bg-tertiary border border-border-default rounded-lg overflow-hidden">
                            <input type="text" placeholder="0.00" className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-sm px-3 py-2.5"/>
                            <span className="pr-3 text-xs text-txt-tertiary font-mono">Shares</span>
                          </div>
                          <button disabled={!isConnected || pool.userShares === 0}
                            className="w-full py-2.5 rounded-lg text-xs font-semibold bg-bg-elevated border border-border-default text-txt-primary disabled:opacity-40 transition-all hover:border-border-strong">
                            Withdraw from Pool
                          </button>
                        </div>
                      </div>
                      {pool.operator && (
                        <div className="mt-3 text-[10px] text-txt-disabled font-mono">Operator: {pool.operator}</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "staking" && (
          <div className="p-6">
            {staking ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Staking info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-txt-primary">PULSE Staking Benefits</h3>
                  <div className="bg-bg-primary rounded-lg p-4 space-y-3">
                    {[
                      { label: "LLP Access", desc: `Stake 1 PULSE → Deposit ${staking.llpAccessRatio} USDC into LLP`, icon: "🛡️" },
                      { label: "Funding Rate Rebate", desc: `Up to ${staking.fundingRebatePercent}% rebate on funding payments`, icon: "💸" },
                      { label: "Zero Withdrawal Fees", desc: "Stake 100+ PULSE for free withdrawals & transfers", icon: "✅" },
                      { label: "Staking Yield", desc: `Current APY: ${staking.apy.toFixed(1)}%`, icon: "📈" },
                    ].map(b => (
                      <div key={b.label} className="flex items-start gap-3 py-2">
                        <span className="text-lg">{b.icon}</span>
                        <div>
                          <div className="text-xs font-semibold text-txt-primary">{b.label}</div>
                          <div className="text-[10px] text-txt-tertiary mt-0.5">{b.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-bg-primary rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">Total PULSE Staked (Network)</span>
                      <span className="text-txt-primary font-mono">{(staking.totalStaked / 1e6).toFixed(1)}M PULSE</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">PULSE Price</span>
                      <span className="text-txt-primary font-mono">${staking.tokenPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">Total Value Staked</span>
                      <span className="text-txt-primary font-mono">{formatUSD(staking.totalStaked * staking.tokenPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Stake/Unstake form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-txt-primary">Your Stake</h3>
                  <div className="bg-bg-primary rounded-lg p-5">
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold font-display text-brand">{staking.userStake.toLocaleString()} PULSE</div>
                      <div className="text-xs text-txt-tertiary mt-1">≈ {formatUSD(staking.userStake * staking.tokenPrice)}</div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center bg-bg-tertiary border border-border-default rounded-lg overflow-hidden">
                        <input type="text" placeholder="Amount to stake" className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-sm px-3 py-3"/>
                        <span className="pr-3 text-xs text-txt-tertiary font-mono">PULSE</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={!isConnected}
                          className="py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary disabled:opacity-40 transition-all">
                          Stake PULSE
                        </button>
                        <button disabled={!isConnected || staking.userStake === 0}
                          className="py-2.5 rounded-lg text-xs font-semibold bg-bg-elevated border border-border-default text-txt-primary disabled:opacity-40 transition-all">
                          Unstake
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-txt-tertiary">
                <p>Staking info will load once the PULSE token contract is deployed.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
