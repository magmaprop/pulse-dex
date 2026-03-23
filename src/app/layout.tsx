import type { Metadata } from "next";
import { Web3Provider } from "@/components/wallet/Web3Provider";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Pulse | Decentralized Perpetual Futures Exchange",
  description:
    "Trade perpetuals with zero fees, low latency, and verifiable matching on Ethereum L2. Powered by ZK proofs.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Pulse DEX",
    description: "Zero-fee perpetual futures trading on Ethereum L2",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-txt-primary font-sans antialiased">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
