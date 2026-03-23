"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { shortenAddress, formatUSD } from "@/lib/utils";

/**
 * Custom connect button that integrates with RainbowKit
 * but uses our own UI design. Shows balance when connected.
 */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold font-sans
                      bg-gradient-to-r from-brand to-emerald-400 text-bg-primary
                      hover:shadow-lg hover:shadow-brand/20 transition-all duration-150
                      active:scale-[0.98]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="6" width="18" height="13" rx="2" />
                      <path d="M3 10h18" />
                      <circle cx="16" cy="14" r="1" fill="currentColor" />
                    </svg>
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold
                      bg-short/10 text-short border border-short/30
                      hover:bg-short/20 transition-all"
                  >
                    ⚠️ Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1">
                  {/* Chain selector */}
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs
                      bg-bg-elevated border border-border-default
                      hover:border-border-strong transition-all"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name ?? "Chain"}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-txt-tertiary"
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>

                  {/* Account button */}
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs
                      bg-bg-elevated border border-border-default
                      hover:border-brand/30 hover:bg-bg-hover transition-all"
                  >
                    {account.displayBalance && (
                      <span className="text-txt-secondary font-mono">
                        {account.displayBalance}
                      </span>
                    )}
                    <span className="text-txt-primary font-semibold font-mono">
                      {account.displayName}
                    </span>
                    <div className="w-2 h-2 rounded-full bg-long animate-pulse" />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
