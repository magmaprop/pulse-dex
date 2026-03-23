"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useLeaderboardStore } from "@/lib/stores";
import { formatUSD, formatNumber, shortenAddress, cn } from "@/lib/utils";

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  diamond: { label: "Diamond", color: "text-cyan-400", bg: "bg-cyan-400/10", emoji: "💎" },
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-400/10", emoji: "🥇" },
  silver: { label: "Silver", color: "text-gray-300", bg: "bg-gray-300/10", emoji: "🥈" },
  bronze: { label: "Bronze", color: "text-amber-600", bg: "bg-amber-600/10", emoji: "🥉" },
};

export function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const { entries, userPoints, currentSeason } = useLeaderboardStore();
  const [tab, setTab] = useState<"rankings" | "mypoints" | "referral">("rankings");

  const seasons = [
    { id: 1, name: "Season 1", status: "ended" },
    { id: 2, name: "Season 2", status: "ended" },
    { id: 3, name: "Season 3", status: "active" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-txt-primary">Leaderboard</h1>
          <p className="text-sm text-txt-tertiary mt-1">Earn points by trading. Top traders win rewards every season.</p>
        </div>
        <div className="flex items-center gap-2">
          {seasons.map(s => (
            <button key={s.id}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-sans transition-all border",
                s.id === currentSeason
                  ? "bg-brand/10 border-brand/30 text-brand font-semibold"
                  : s.status === "ended"
                    ? "bg-bg-elevated border-border-subtle text-txt-disabled"
                    : "bg-bg-elevated border-border-default text-txt-secondary"
              )}>
              {s.name}
              {s.status === "active" && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-long inline-block animate-pulse"/>}
            </button>
          ))}
        </div>
      </div>

      {/* Season banner */}
      <div className="bg-gradient-to-r from-bg-tertiary via-brand/5 to-bg-tertiary rounded-xl border border-brand/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <h2 className="text-lg font-bold font-display text-txt-primary">Season 3 — Active</h2>
            </div>
            <p className="text-xs text-txt-tertiary max-w-md">
              250,000 points distributed weekly based on trading volume, order quality, and market diversity.
              Points convert to $PULSE tokens at the end of each season.
            </p>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Weekly Distribution</div>
            <div className="text-2xl font-bold font-display text-brand">250,000</div>
            <div className="text-xs text-txt-tertiary">points / week</div>
          </div>
        </div>
      </div>

      {/* User stats (if connected) */}
      {isConnected && userPoints && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Your Rank</div>
            <div className="text-xl font-bold font-display text-txt-primary mt-1">#{userPoints.rank}</div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">Total Points</div>
            <div className="text-xl font-bold font-display text-brand mt-1">{formatNumber(userPoints.totalPoints)}</div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">This Week</div>
            <div className="text-xl font-bold font-display text-txt-primary mt-1">{formatNumber(userPoints.weeklyPoints)}</div>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <div className="text-[10px] text-txt-tertiary uppercase tracking-wider">From Referrals</div>
            <div className="text-xl font-bold font-display text-txt-primary mt-1">{formatNumber(userPoints.referralPoints)}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-bg-secondary rounded-lg border border-border-subtle overflow-hidden">
        <div className="flex border-b border-border-subtle px-1">
          {[
            { id: "rankings" as const, label: "Rankings" },
            { id: "mypoints" as const, label: "My Points" },
            { id: "referral" as const, label: "Referral Program" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-3 text-xs font-sans transition-all border-b-2",
                tab === t.id ? "text-txt-primary font-semibold border-brand" : "text-txt-tertiary border-transparent hover:text-txt-secondary"
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "rankings" && (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-txt-tertiary uppercase tracking-wider font-mono">
                  {["Rank", "Trader", "Tier", "Points", "Volume", "Trades", "PnL"].map(h => (
                    <th key={h} className="text-left px-4 py-3 border-b border-border-subtle font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-txt-tertiary">Leaderboard data will appear once trading begins.</td></tr>
                ) : (
                  entries.slice(0, 25).map((entry) => {
                    const tier = TIER_CONFIG[entry.tier];
                    const isUser = isConnected && entry.address === shortenAddress(address || "");
                    return (
                      <tr key={entry.rank}
                        className={cn(
                          "border-b border-border-subtle transition-colors",
                          isUser ? "bg-brand/5" : "hover:bg-bg-hover"
                        )}>
                        <td className="px-4 py-3 font-mono">
                          {entry.rank <= 3 ? (
                            <span className="text-base">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                          ) : (
                            <span className="text-txt-secondary font-semibold">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-txt-primary font-medium">
                          {entry.address}
                          {isUser && <span className="ml-2 text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">YOU</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", tier.bg, tier.color)}>
                            {tier.emoji} {tier.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-brand">{formatNumber(entry.points)}</td>
                        <td className="px-4 py-3 font-mono text-txt-secondary">{formatUSD(entry.volume)}</td>
                        <td className="px-4 py-3 font-mono text-txt-secondary">{formatNumber(entry.trades)}</td>
                        <td className={cn("px-4 py-3 font-mono font-semibold", entry.pnl >= 0 ? "text-long" : "text-short")}>
                          {entry.pnl >= 0 ? "+" : ""}{formatUSD(entry.pnl)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "mypoints" && (
          <div className="p-6">
            {!isConnected ? (
              <div className="text-center py-12">
                <p className="text-sm text-txt-tertiary">Connect your wallet to view your points</p>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-txt-primary">How Points Are Earned</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { factor: "Trading Volume", desc: "Higher volume across all markets = more points", weight: "40%" },
                    { factor: "Order Quality", desc: "Limit orders and longer-held positions are rewarded more", weight: "25%" },
                    { factor: "Market Diversity", desc: "Trading across multiple markets earns bonus points", weight: "20%" },
                    { factor: "Referrals", desc: "Earn 25% of your referrals' points continuously", weight: "15%" },
                  ].map(f => (
                    <div key={f.factor} className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-semibold text-txt-primary">{f.factor}</span>
                        <span className="text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded">{f.weight}</span>
                      </div>
                      <p className="text-[10px] text-txt-tertiary">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "referral" && (
          <div className="p-6">
            <div className="max-w-lg mx-auto space-y-6">
              <div className="text-center">
                <span className="text-4xl">🎁</span>
                <h3 className="text-lg font-bold font-display text-txt-primary mt-3">Invite & Earn Together</h3>
                <p className="text-xs text-txt-tertiary mt-2 max-w-sm mx-auto">
                  Share your referral link and earn 25% of your friends' points — forever. They get a welcome bonus too.
                </p>
              </div>

              {isConnected ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-txt-tertiary mb-2 block">Your Referral Link</label>
                    <div className="flex items-center bg-bg-primary border border-border-default rounded-lg overflow-hidden">
                      <input readOnly value={`https://app.pulse.trade/trade?ref=${shortenAddress(address || "")}`}
                        className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-xs px-3 py-3"/>
                      <button onClick={() => navigator.clipboard.writeText(`https://app.pulse.trade/trade?ref=${address}`)}
                        className="px-4 py-3 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors border-l border-border-default">
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-bg-primary rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">Referrals invited</span>
                      <span className="text-txt-primary font-mono">0</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">Active referrals</span>
                      <span className="text-txt-primary font-mono">0</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-tertiary">Points from referrals</span>
                      <span className="text-brand font-mono font-semibold">0</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-txt-tertiary">Connect your wallet to get your referral link</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
