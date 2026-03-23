"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { SUPPORTED_CHAINS } from "@/config/wagmi";
import { useUIStore } from "@/lib/stores";
import { cn, formatUSD } from "@/lib/utils";

export function WithdrawModal() {
  const { withdrawModalOpen, setWithdrawModalOpen } = useUIStore();
  const { address, isConnected } = useAccount();
  const [selectedChainId, setSelectedChainId] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "processing" | "success" | "error">("amount");
  const [error, setError] = useState("");

  // In production, fetch from backend: GET /api/account
  const tradingBalance = 0; // Will come from API

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (parseFloat(amount) > tradingBalance) {
      setError("Insufficient trading balance");
      return;
    }

    setStep("processing");
    setError("");

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const token = localStorage.getItem("pulse_auth_token");

      const res = await fetch(`${API_URL}/api/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          chain: selectedChainId,
          destination: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Withdrawal failed");
      }

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Withdrawal failed");
      setStep("error");
    }
  };

  const handleClose = () => {
    setWithdrawModalOpen(false);
    setAmount("");
    setStep("amount");
    setError("");
  };

  if (!withdrawModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-[420px] max-w-[90vw] bg-bg-elevated rounded-xl border border-border-strong shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold font-display text-txt-primary">Withdraw USDC</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-bg-hover transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-tertiary">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "amount" && (
            <>
              {/* Destination chain */}
              <div>
                <label className="text-xs text-txt-tertiary font-sans mb-2 block">Withdraw to</label>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_CHAINS.map((c) => (
                    <button key={c.id} onClick={() => setSelectedChainId(c.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                        selectedChainId === c.id
                          ? "bg-brand/10 border-brand/30 border text-brand"
                          : "bg-bg-primary border border-border-default text-txt-secondary hover:border-border-strong"
                      )}>
                      <span className="text-base">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination address */}
              <div>
                <label className="text-xs text-txt-tertiary font-sans mb-2 block">Destination</label>
                <div className="bg-bg-primary border border-border-default rounded-lg px-3 py-2.5">
                  <p className="text-xs font-mono text-txt-secondary truncate">
                    {address || "Connect wallet first"}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-txt-tertiary font-sans">Amount</label>
                  <span className="text-xs text-txt-tertiary font-mono">
                    Trading balance: <span className="text-txt-secondary">{formatUSD(tradingBalance)}</span>
                  </span>
                </div>
                <div className="flex items-center bg-bg-primary border border-border-default rounded-lg overflow-hidden focus-within:border-brand/30">
                  <input type="text" inputMode="decimal" value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      if (v.split(".").length <= 2) setAmount(v);
                    }}
                    placeholder="0.00"
                    className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-lg px-4 py-3" />
                  <div className="flex items-center gap-2 px-4">
                    <button onClick={() => setAmount(tradingBalance.toString())}
                      className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded hover:bg-brand/20 transition-colors">
                      MAX
                    </button>
                    <span className="text-xs text-txt-tertiary font-mono">USDC</span>
                  </div>
                </div>
              </div>

              {/* Fee info */}
              <div className="bg-bg-primary rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-txt-tertiary">You withdraw</span>
                  <span className="text-txt-primary font-mono">{amount || "0"} USDC</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-txt-tertiary">Withdrawal fee</span>
                  <span className="text-brand font-mono font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-txt-tertiary">You receive</span>
                  <span className="text-txt-primary font-mono font-semibold">{amount || "0"} USDC</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-txt-tertiary">Est. time</span>
                  <span className="text-txt-secondary font-mono">~5–30 min</span>
                </div>
              </div>

              {error && (
                <div className="bg-short/10 border border-short/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-short">{error}</p>
                </div>
              )}

              <button onClick={handleWithdraw}
                disabled={!isConnected || !amount || parseFloat(amount) <= 0}
                className="w-full py-3 rounded-lg text-sm font-semibold font-sans bg-bg-active border border-border-default text-txt-primary hover:border-border-strong transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {!isConnected ? "Connect Wallet" : !amount || parseFloat(amount) <= 0 ? "Enter Amount" : `Withdraw ${amount} USDC`}
              </button>

              <p className="text-[10px] text-txt-disabled text-center">
                Withdrawals are processed by the Pulse operator. Force-withdraw available on-chain after 7 days if operator is unresponsive.
              </p>
            </>
          )}

          {step === "processing" && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-txt-primary font-semibold">Processing Withdrawal</p>
              <p className="text-xs text-txt-tertiary mt-1">This may take a few minutes...</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm text-txt-primary font-semibold">Withdrawal Submitted!</p>
              <p className="text-xs text-txt-tertiary mt-1">{amount} USDC will be sent to your wallet on {SUPPORTED_CHAINS.find(c => c.id === selectedChainId)?.name}</p>
              <button onClick={handleClose}
                className="mt-4 px-6 py-2 rounded-lg text-xs font-semibold bg-bg-active text-txt-primary hover:bg-bg-hover transition-colors">
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">❌</div>
              <p className="text-sm text-txt-primary font-semibold">Withdrawal Failed</p>
              <p className="text-xs text-short mt-1">{error}</p>
              <button onClick={() => { setStep("amount"); setError(""); }}
                className="mt-4 px-6 py-2 rounded-lg text-xs font-semibold bg-bg-active text-txt-primary hover:bg-bg-hover transition-colors">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
