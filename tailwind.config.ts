import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#08090c",
          secondary: "#0f1016",
          tertiary: "#151720",
          elevated: "#1b1d2a",
          hover: "#222540",
          active: "#2a2d50",
        },
        brand: {
          DEFAULT: "#6ee7b7",
          dim: "rgba(110,231,183,0.12)",
          mid: "rgba(110,231,183,0.25)",
          glow: "rgba(110,231,183,0.06)",
        },
        long: { DEFAULT: "#22c55e", dim: "rgba(34,197,94,0.12)" },
        short: { DEFAULT: "#ef4444", dim: "rgba(239,68,68,0.12)" },
        txt: {
          primary: "#e8eaed",
          secondary: "#8b8fa3",
          tertiary: "#5c6078",
          disabled: "#3d4060",
        },
        border: {
          subtle: "rgba(255,255,255,0.04)",
          default: "rgba(255,255,255,0.07)",
          strong: "rgba(255,255,255,0.12)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "DM Sans", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "slide-down": "slideDown 0.2s ease-out",
        pulse: "pulse 2s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
