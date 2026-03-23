/**
 * Format a price with appropriate decimal places
 */
export function formatPrice(price: number, decimals?: number): string {
  const d =
    decimals ??
    (price > 10000
      ? 2
      : price > 100
        ? 2
        : price > 1
          ? 4
          : price > 0.01
            ? 6
            : 8);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/**
 * Format a size/quantity
 */
export function formatSize(size: number): string {
  if (size < 0.001) return size.toFixed(8);
  if (size < 0.01) return size.toFixed(6);
  if (size < 1) return size.toFixed(4);
  return size.toFixed(2);
}

/**
 * Format USD value with abbreviation
 */
export function formatUSD(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Format percentage with sign
 */
export function formatPercent(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

/**
 * Format funding rate
 */
export function formatFundingRate(rate: number): string {
  return `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(4)}%`;
}

/**
 * Format timestamp to time string
 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format timestamp to date string
 */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Shorten an address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a large number with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Classname utility (like clsx but lightweight)
 */
export function cn(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}
