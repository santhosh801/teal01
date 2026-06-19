import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { subscribe } from '../../services/socket';

const CHART_THEME = {
  background: { type: ColorType.Solid, color: '#0d1326' },
  textColor: '#64748b',
  grid: {
    vertLines: { color: '#1e2d4a', style: LineStyle.Dotted },
    horzLines: { color: '#1e2d4a', style: LineStyle.Dotted },
  },
  crosshair: {
    vertLine: { color: '#00d4ff44', labelBackgroundColor: '#0d1326' },
    horzLine: { color: '#00d4ff44', labelBackgroundColor: '#0d1326' },
  },
  timeScale: {
    borderColor: '#1e2d4a',
    timeVisible: true,
    secondsVisible: true,
  },
  rightPriceScale: { borderColor: '#1e2d4a' },
};

const SERIES_COLORS = {
  RELIANCE: '#00d4ff',
  TCS: '#8b5cf6',
};

export default function SymbolChart({ symbol }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const [tickCount, setTickCount] = useState(0);

  /* ── Create chart once on mount ─────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: CHART_THEME,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 220,
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const color = SERIES_COLORS[symbol] || '#00d4ff';

    const series = chart.addLineSeries({
      color,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: color,
      crosshairMarkerBackgroundColor: '#0d1326',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: `${color}55`,
      priceLineStyle: LineStyle.Dashed,
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    /* Responsive resize */
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  /* ── Subscribe to live price updates ────────────────── */
  useEffect(() => {
    const unsub = subscribe('price_update', (data) => {
      if (data.symbol !== symbol || !seriesRef.current) return;

      const rawTS = data.TS;
      if (!rawTS) return;

      /* Lightweight Charts expects time in UTC seconds (integer) */
      const timeSeconds = Math.floor(new Date(rawTS).getTime() / 1000);
      const value = Number(data.price);

      if (isNaN(timeSeconds) || isNaN(value)) return;

      seriesRef.current.update({ time: timeSeconds, value });
      setTickCount((n) => n + 1);
    });
    return unsub;
  }, [symbol]);

  const color = SERIES_COLORS[symbol] || '#00d4ff';

  return (
    <div className="symbol-chart glass">
      <div className="symbol-chart__header">
        <div className="symbol-chart__title" style={{ color }}>
          <span className="symbol-chart__dot" style={{ background: color }} />
          {symbol}
        </div>
        <span className="symbol-chart__ticks">{tickCount.toLocaleString()} ticks</span>
      </div>
      <div ref={containerRef} className="symbol-chart__canvas" />
    </div>
  );
}
