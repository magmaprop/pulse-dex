import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, base, sepolia } from "wagmi/chains";
import { http } from "wagmi";

// Custom Pulse L2 chain definition (for when contracts are deployed)
// export const pulseChain = defineChain({
//   id: 0x_LIGHTER_CHAIN_ID,
//   name: 'Pulse',
//   nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
//   rpcUrls: { default: { http: ['https://rpc.pulse.trade'] } },
//   blockExplorers: { default: { name: 'Pulse Explorer', url: 'https://explorer.pulse.trade' } },
// });

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";

export const wagmiConfig = getDefaultConfig({
  appName: "Pulse DEX",
  projectId: walletConnectProjectId,
  chains: [
    mainnet,
    arbitrum,
    base,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL_MAINNET ||
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
    [arbitrum.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL_ARBITRUM ||
        `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL_BASE ||
        `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true"
      ? { [sepolia.id]: http() }
      : {}),
  },
  ssr: true,
});

// Supported chains for deposit/withdrawal
export const SUPPORTED_CHAINS = [
  { id: mainnet.id, name: "Ethereum", icon: "🔷", color: "#627EEA" },
  { id: arbitrum.id, name: "Arbitrum", icon: "🔵", color: "#28A0F0" },
  { id: base.id, name: "Base", icon: "🟦", color: "#0052FF" },
] as const;

// USDC contract addresses per chain
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [arbitrum.id]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [sepolia.id]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // testnet USDC
};

// Vault contract addresses (fill after deployment)
export const VAULT_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: "0x0000000000000000000000000000000000000000",
  [arbitrum.id]: "0x0000000000000000000000000000000000000000",
  [base.id]: "0x0000000000000000000000000000000000000000",
};
