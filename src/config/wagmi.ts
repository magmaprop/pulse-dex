import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, base } from "wagmi/chains";
import { http } from "wagmi";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";

export const wagmiConfig = getDefaultConfig({
  appName: "Pulse DEX",
  projectId: walletConnectProjectId,
  chains: [mainnet, arbitrum, base],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
        : undefined
    ),
    [arbitrum.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_KEY
        ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
        : undefined
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
        : undefined
    ),
  },
  ssr: true,
});

export const SUPPORTED_CHAINS = [
  { id: mainnet.id, name: "Ethereum", icon: "🔷", color: "#627EEA" },
  { id: arbitrum.id, name: "Arbitrum", icon: "🔵", color: "#28A0F0" },
  { id: base.id, name: "Base", icon: "🟦", color: "#0052FF" },
] as const;

export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [arbitrum.id]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export const VAULT_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: "0x0000000000000000000000000000000000000000",
  [arbitrum.id]: "0x0000000000000000000000000000000000000000",
  [base.id]: "0x0000000000000000000000000000000000000000",
};
