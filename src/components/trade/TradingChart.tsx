"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/lib/stores";
import { cn } from "@/lib/utils";

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

function generateCandles(basePrice: number, count: number, intervalSec: number) {
  const candles = [];
  let price = basePrice * (0.95 + Math.random() * 0.05);
  const now = Math.floor(Date.now() / 1000);
  const startTime = Math.floor((now - count * intervalSec) / intervalSec) * intervalSec;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSec;
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.008;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.random() * 100 + 10;

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const dataLoadedRef = useRef<string>("");
  const [interval, setInterval] = useState<Interval>("1h");
  const [chartReady, setChartReady] = useState(false);

  const selectedMarket = useMarketStore((s) => s.selectedMarket);

  // Load lightweight-charts
  useEffect(() => {
    import("lightweight-charts").then(() => {
      setChartReady(true);
    });
  }, []);

  // Create chart
  useEffect(() => {
    if (!chartReady || !containerRef.current) return;

    let chart: any;

    import("lightweight-charts").then((mod) => {
      if (!containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        dataLoadedRef.current = "";
      }

      chart = mod.createChart(containerRef.current, {
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
          mode: 0,
          vertLine: { color: "rgba(110,231,183,0.3)", style: 3, width: 1, labelBackgroundColor: "#1b1d2a" },
          horzLine: { color: "rgba(110,231,183,0.3)", style: 3, width: 1, labelBackgroundColor: "#1b1d2a" },
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
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

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

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            chart.applyOptions({ width, height });
          }
        }
      });
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        dataLoadedRef.current = "";
      }
    };
  }, [chartReady]);

  // Load data when market or interval changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (!selectedMarket?.price || selectedMarket.price === 0) return;

    const key = `${selectedMarket.symbol}-${interval}`;
    if (dataLoadedRef.current === key) return;
    dataLoadedRef.current = key;

    try {
      const candles = generateCandles(selectedMarket.price, 200, INTERVAL_MS[interval]);

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
        color: c.close >= c.open ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error("[Chart] Error loading data:", err);
    }
  }, [selectedMarket?.symbol, selectedMarket?.price, interval]);

  return (
    <div className="relative w-full h-full bg-bg-primary">
      <div className="absolute top-2 left-3 z-10 flex gap-1">
        {INTERVALS.map((tf) => (
          <button
            key={tf.value}
            onClick={() => {
              dataLoadedRef.current = "";
              setInterval(tf.value);
            }}
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

      <div ref={containerRef} className="w-full h-full" />

      {(!chartReady || !selectedMarket?.price) && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-txt-tertiary">
              {!chartReady ? "Loading chart..." : "Waiting for price data..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
