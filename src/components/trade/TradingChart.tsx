"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMarketStore, useOrderBookStore } from "@/lib/stores";
import { cn } from "@/lib/utils";

// Dynamic import lightweight-charts (it uses window)
let createChart: any = null;
let CandlestickSeries: any = null;
let HistogramSeries: any = null;
let LineSeries: any = null;

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

// Generate candle data from price (will be replaced by real API data)
function generateCandlesFromPrice(basePrice: number, count: number, intervalMs: number) {
  const candles = [];
  let price = basePrice * (0.95 + Math.random() * 0.05);
  const now = Math.floor(Date.now() / 1000);

  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.008;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.random() * 100 + 10;

    candles.push({
      time: now - i * Math.floor(intervalMs / 1000),
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [interval, setInterval] = useState<Interval>("1h");
  const [chartLoaded, setChartLoaded] = useState(false);

  const selectedMarket = useMarketStore((s) => s.selectedMarket);
  const recentTrades = useOrderBookStore((s) => s.recentTrades);

  // Load lightweight-charts dynamically
  useEffect(() => {
    import("lightweight-charts").then((mod) => {
      createChart = mod.createChart;
      setChartLoaded(true);
    });
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartLoaded || !containerRef.current || !createChart) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#08090c" },
        textColor: "#5c6078",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: {
          color: "rgba(110,231,183,0.3)",
          style: 3,
          width: 1,
          labelBackgroundColor: "#1b1d2a",
        },
        horzLine: {
          color: "rgba(110,231,183,0.3)",
          style: 3,
          width: 1,
          labelBackgroundColor: "#1b1d2a",
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.04)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.04)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: "rgba(110,231,183,0.08)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartLoaded]);

  // Load candle data when market or interval changes
  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !volumeSeriesRef.current ||
      !selectedMarket?.price ||
      selectedMarket.price === 0
    )
      return;

    const intervalMs: Record<Interval, number> = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1h": 3600000,
      "4h": 14400000,
      "1d": 86400000,
    };

    // In production, fetch from API: GET /api/candles/{marketId}?interval={interval}
    // For now, generate from current price
    const candles = generateCandlesFromPrice(
      selectedMarket.price,
      200,
      intervalMs[interval]
    );

    const candleData = candles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color:
        c.close >= c.open
          ? "rgba(34,197,94,0.15)"
          : "rgba(239,68,68,0.15)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [selectedMarket?.symbol, selectedMarket?.price, interval]);

  // Update last candle with live price
  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !selectedMarket?.price ||
      selectedMarket.price === 0
    )
      return;

    const now = Math.floor(Date.now() / 1000);
    // Round to current interval
    const intervalSeconds: Record<Interval, number> = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "1h": 3600,
      "4h": 14400,
      "1d": 86400,
    };
    const roundedTime =
      Math.floor(now / intervalSeconds[interval]) * intervalSeconds[interval];

    candleSeriesRef.current.update({
      time: roundedTime as any,
      open: selectedMarket.price * (1 - Math.random() * 0.001),
      high: selectedMarket.price * (1 + Math.random() * 0.001),
      low: selectedMarket.price * (1 - Math.random() * 0.001),
      close: selectedMarket.price,
    });
  }, [selectedMarket?.price, interval]);

  return (
    <div className="relative w-full h-full bg-bg-primary">
      {/* Interval selector */}
      <div className="absolute top-2 left-3 z-10 flex gap-1">
        {INTERVALS.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setInterval(tf.value)}
            className={cn(
              "px-2 py-1 text-[10px] font-mono rounded border transition-all",
              interval === tf.value
                ? "text-brand bg-brand/10 border-brand/20"
                : "text-txt-tertiary bg-bg-secondary/80 border-border-subtle hover:border-border-default backdrop-blur-sm"
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Market info overlay */}
      {selectedMarket && (
        <div className="absolute top-2 right-3 z-10 text-right">
          <span className="text-[10px] font-mono text-txt-tertiary">
            {selectedMarket.symbol}
          </span>
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading state */}
      {(!chartLoaded || !selectedMarket?.price) && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-txt-tertiary">
              {!chartLoaded
                ? "Loading chart..."
                : "Waiting for price data..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
