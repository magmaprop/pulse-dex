"use client";

import { useState } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { USDC_ADDRESSES, VAULT_ADDRESSES, SUPPORTED_CHAINS } from "@/config/wagmi";
import { useUIStore } from "@/lib/stores";
import { cn, formatUSD } from "@/lib/utils";

// Standard ERC20 ABI for approve + transfer
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Simplified vault ABI for deposit
const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

type Step = "amount" | "approve" | "deposit" | "success";

export function DepositModal() {
  const { depositModalOpen, setDepositModalOpen } = useUIStore();
  const { address, chain } = useAccount();
  const [selectedChainId, setSelectedChainId] = useState<number>(
    chain?.id || 1
  );
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("amount");

  const usdcAddress = USDC_ADDRESSES[selectedChainId];
  const vaultAddress = VAULT_ADDRESSES[selectedChainId];

  // Fetch USDC balance on selected chain
  const { data: usdcBalance } = useBalance({
    address,
    token: usdcAddress,
    chainId: selectedChainId,
  });

  // Approve USDC spending
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract();

  // Deposit to vault
  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositing,
  } = useWriteContract();

  // Wait for approve tx
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Wait for deposit tx
  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const parsedAmount = amount ? parseUnits(amount, 6) : BigInt(0); // USDC has 6 decimals

  const handleApprove = () => {
    if (!usdcAddress || !vaultAddress) return;
    approve({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress, parsedAmount],
      chainId: selectedChainId,
    });
    setStep("approve");
  };

  const handleDeposit = () => {
    if (!vaultAddress) return;
    deposit({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [parsedAmount],
      chainId: selectedChainId,
    });
    setStep("deposit");
  };

  const handleClose = () => {
    setDepositModalOpen(false);
    setAmount("");
    setStep("amount");
  };

  if (!depositModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[420px] max-w-[90vw] bg-bg-elevated rounded-xl border border-border-strong
          shadow-2xl animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold font-display text-txt-primary">
            Deposit USDC
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-bg-hover transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-txt-tertiary"
            >
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Chain selector */}
          <div>
            <label className="text-xs text-txt-tertiary font-sans mb-2 block">
              From Chain
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_CHAINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChainId(c.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                    selectedChainId === c.id
                      ? "bg-brand/10 border-brand/30 border text-brand"
                      : "bg-bg-primary border border-border-default text-txt-secondary hover:border-border-strong"
                  )}
                >
                  <span className="text-base">{c.icon}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-txt-tertiary font-sans">
                Amount
              </label>
              <span className="text-xs text-txt-tertiary font-mono">
                Balance:{" "}
                <span className="text-txt-secondary">
                  {usdcBalance
                    ? formatUnits(usdcBalance.value, 6)
                    : "0.00"}{" "}
                  USDC
                </span>
              </span>
            </div>
            <div className="flex items-center bg-bg-primary border border-border-default rounded-lg overflow-hidden focus-within:border-brand/30 transition-colors">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  if (v.split(".").length <= 2) setAmount(v);
                }}
                placeholder="0.00"
                className="flex-1 bg-transparent border-none outline-none text-txt-primary font-mono text-lg px-4 py-3"
              />
              <div className="flex items-center gap-2 px-4">
                <button
                  onClick={() => {
                    if (usdcBalance)
                      setAmount(formatUnits(usdcBalance.value, 6));
                  }}
                  className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded hover:bg-brand/20 transition-colors"
                >
                  MAX
                </button>
                <span className="text-xs text-txt-tertiary font-mono">
                  USDC
                </span>
              </div>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2 mt-2">
              {[100, 500, 1000, 5000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v.toString())}
                  className="flex-1 py-1.5 text-[10px] font-mono text-txt-tertiary bg-bg-primary border border-border-subtle rounded hover:border-border-default transition-colors"
                >
                  ${v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-bg-primary rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-txt-tertiary font-sans">You deposit</span>
              <span className="text-txt-primary font-mono">
                {amount || "0"} USDC
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-txt-tertiary font-sans">
                You receive (trading balance)
              </span>
              <span className="text-txt-primary font-mono">
                {amount || "0"} USDC
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-txt-tertiary font-sans">
                Deposit fee
              </span>
              <span className="text-brand font-mono font-semibold">Free</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-txt-tertiary font-sans">
                Est. time
              </span>
              <span className="text-txt-secondary font-mono">~2 min</span>
            </div>
          </div>

          {/* Action buttons */}
          {!address ? (
            <p className="text-center text-xs text-txt-tertiary py-2">
              Connect your wallet to deposit
            </p>
          ) : step === "amount" ? (
            <button
              onClick={handleApprove}
              disabled={!amount || parseFloat(amount) <= 0}
              className="w-full py-3 rounded-lg text-sm font-semibold font-sans
                bg-gradient-to-r from-brand to-emerald-400 text-bg-primary
                hover:shadow-lg hover:shadow-brand/20 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!amount || parseFloat(amount) <= 0
                ? "Enter Amount"
                : `Approve & Deposit ${amount} USDC`}
            </button>
          ) : step === "approve" ? (
            <button
              disabled
              className="w-full py-3 rounded-lg text-sm font-semibold font-sans
                bg-bg-active text-txt-secondary flex items-center justify-center gap-2"
            >
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              {isApproving
                ? "Confirm in wallet..."
                : isApproveConfirming
                  ? "Approving USDC..."
                  : "Processing..."}
            </button>
          ) : step === "success" || isDepositConfirmed ? (
            <div className="text-center py-2">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm text-txt-primary font-semibold">
                Deposit Successful!
              </p>
              <p className="text-xs text-txt-tertiary mt-1">
                {amount} USDC has been added to your trading account
              </p>
              <button
                onClick={handleClose}
                className="mt-3 px-6 py-2 rounded-lg text-xs font-semibold bg-bg-active text-txt-primary hover:bg-bg-hover transition-colors"
              >
                Done
              </button>
            </div>
          ) : null}

          {/* Approve confirmed → Deposit */}
          {isApproveConfirmed && step === "approve" && (
            <button
              onClick={handleDeposit}
              className="w-full py-3 rounded-lg text-sm font-semibold font-sans
                bg-gradient-to-r from-brand to-emerald-400 text-bg-primary
                hover:shadow-lg hover:shadow-brand/20 transition-all"
            >
              Deposit {amount} USDC
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
