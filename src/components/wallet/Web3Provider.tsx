"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

// Custom RainbowKit theme matching our trading UI
const customTheme = darkTheme({
  accentColor: "#6ee7b7",
  accentColorForeground: "#08090c",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

// Override specific theme tokens
customTheme.colors.modalBackground = "#1b1d2a";
customTheme.colors.modalBorder = "rgba(255,255,255,0.07)";
customTheme.colors.profileForeground = "#151720";
customTheme.colors.closeButton = "#8b8fa3";
customTheme.colors.closeButtonBackground = "rgba(255,255,255,0.07)";
customTheme.colors.connectButtonBackground = "#1b1d2a";
customTheme.colors.connectButtonBackgroundError = "rgba(239,68,68,0.12)";
customTheme.colors.connectButtonInnerBackground = "#151720";
customTheme.fonts.body = "DM Sans, system-ui, sans-serif";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={customTheme}
          modalSize="compact"
          appInfo={{
            appName: "Pulse DEX",
            learnMoreUrl: "https://docs.pulse.trade",
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
