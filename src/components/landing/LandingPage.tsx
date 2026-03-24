"use client";

import { useState, useEffect } from "react";
import { useUIStore } from "@/lib/stores";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: "⚡",
    title: "Zero Trading Fees",
    desc: "Standard accounts pay 0% maker and 0% taker fees. Keep every dollar of profit.",
  },
  {
    icon: "🔐",
    title: "Verifiable Matching",
    desc: "Every order match and liquidation is cryptographically proven. No black box.",
  },
  {
    icon: "🚀",
    title: "Millisecond Latency",
    desc: "Tens of thousands of orders per second. CEX-grade speed on decentralized rails.",
  },
  {
    icon: "🛡️",
    title: "Non-Custodial",
    desc: "Your keys, your funds. Emergency exit via Ethereum if anything goes wrong.",
  },
  {
    icon: "🌍",
    title: "Multi-Asset",
    desc: "Trade crypto, FX, equities, and RWA perpetuals — all from one account.",
  },
  {
    icon: "💎",
    title: "Earn Rewards",
    desc: "Earn PULSE points every week by trading. Top traders share seasonal token rewards.",
  },
];

const STATS = [
  { label: "Trading Volume", value: "$0", suffix: "and growing" },
  { label: "Total Users", value: "0", suffix: "early access" },
  { label: "Markets", value: "6+", suffix: "and expanding" },
  { label: "Trading Fees", value: "0%", suffix: "for retail" },
];

export function LandingPage() {
  const { setCurrentPage } = useUIStore();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handle = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handle);
    return () => window.removeEventListener("scroll", handle);
  }, []);

  const handleLaunch = () => {
    setCurrentPage("portfolio");
  };

  return (
    <div className="min-h-screen bg-bg-primary text-txt-primary overflow-auto">
      {/* Nav */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrollY > 50 ? "bg-bg-secondary/90 backdrop-blur-lg border-b border-border-subtle" : "bg-transparent"
      )}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-emerald-400 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#08090c">
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
            </div>
            <span className="text-lg font-bold font-display tracking-tight">Pulse</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-txt-secondary">
            <a href="#features" className="hover:text-txt-primary transition-colors">Features</a>
            <a href="#markets" className="hover:text-txt-primary transition-colors">Markets</a>
            <a href="https://docs.pulse.trade" className="hover:text-txt-primary transition-colors" target="_blank" rel="noopener">Docs</a>
          </div>
          <button onClick={handleLaunch}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary hover:shadow-lg hover:shadow-brand/20 transition-all">
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 border border-brand/20 mb-8">
            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-xs font-medium text-brand">Now Live — Season 1 Points Active</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display tracking-tight leading-[1.1] mb-6">
            Trade Perpetuals
            <br />
            <span className="bg-gradient-to-r from-brand via-emerald-300 to-teal-400 bg-clip-text text-transparent">
              At the Speed of Light
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-txt-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Zero-fee perpetual futures on Ethereum L2. Verifiable matching,
            millisecond execution, and non-custodial security — the way trading should be.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={handleLaunch}
              className="px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary hover:shadow-xl hover:shadow-brand/25 transition-all hover:-translate-y-0.5 w-full sm:w-auto">
              Start Trading — It's Free
            </button>
            <a href="https://docs.pulse.trade" target="_blank" rel="noopener"
              className="px-8 py-4 rounded-xl text-base font-semibold bg-bg-elevated border border-border-default text-txt-primary hover:border-border-strong transition-all w-full sm:w-auto text-center">
              Read the Docs
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold font-display text-txt-primary">{s.value}</div>
                <div className="text-xs text-txt-tertiary mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              Built for Serious Traders
            </h2>
            <p className="text-txt-secondary max-w-xl mx-auto">
              Every component engineered for performance, transparency, and trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="group p-6 rounded-xl bg-bg-secondary border border-border-subtle hover:border-brand/20 transition-all duration-300 hover:-translate-y-1">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-semibold font-display text-txt-primary mb-2 group-hover:text-brand transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-txt-tertiary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section id="markets" className="py-24 px-6 bg-bg-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              Trade Every Market
            </h2>
            <p className="text-txt-secondary max-w-xl mx-auto">
              Crypto, forex, equities, and real-world assets — all as perpetual futures with up to 50x leverage.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {["BTC", "ETH", "SOL", "ARB", "DOGE", "EUR/USD"].map((m) => (
              <div key={m} className="bg-bg-primary rounded-xl p-4 border border-border-subtle text-center hover:border-brand/20 transition-all cursor-pointer"
                onClick={handleLaunch}>
                <div className="text-lg font-bold font-display text-txt-primary mb-1">{m}</div>
                <div className="text-xs text-txt-tertiary">Up to 50x</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            Ready to Trade?
          </h2>
          <p className="text-txt-secondary mb-8 max-w-lg mx-auto">
            Connect your wallet, deposit USDC, and start trading in under a minute. Zero fees for all standard accounts.
          </p>
          <button onClick={handleLaunch}
            className="px-10 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-brand to-emerald-400 text-bg-primary hover:shadow-xl hover:shadow-brand/25 transition-all hover:-translate-y-0.5">
            Launch App
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand to-emerald-400 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#08090c">
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
            </div>
            <span className="text-sm font-semibold font-display">Pulse</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-txt-tertiary">
            <a href="https://docs.pulse.trade" className="hover:text-txt-secondary transition-colors">Docs</a>
            <a href="https://twitter.com/PulseDEX" className="hover:text-txt-secondary transition-colors">Twitter</a>
            <a href="https://discord.gg/pulse" className="hover:text-txt-secondary transition-colors">Discord</a>
            <a href="https://github.com/pulse-dex" className="hover:text-txt-secondary transition-colors">GitHub</a>
          </div>
          <div className="text-xs text-txt-disabled">
            © 2026 Pulse. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
