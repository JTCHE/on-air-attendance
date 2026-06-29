"use client";
import { useEffect, useRef, useState } from "react";
import type { Reading } from "@/lib/db";

// Hand-rolled SVG so there's no chart-lib resize loop. Measured once per
// container resize (guarded), then pure math — fast and deterministic.
export function TrendChart({ data, loading }: { data: Reading[]; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(([e]) => {
      const { width: newWidth, height: newHeight } = e.contentRect;
      setSize((s) => (Math.abs(s.width - newWidth) < 1 && Math.abs(s.height - newHeight) < 1 ? s : { width: newWidth, height: newHeight }));
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative h-full w-full transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {data.length < 2 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Not enough data yet</div>
      ) : width > 0 && height > 0 ? (
        <Plot
          data={data}
          width={width}
          height={height}
          hover={hover}
          setHover={setHover}
        />
      ) : null}
    </div>
  );
}

function Plot({
  data,
  width,
  height,
  hover,
  setHover,
}: {
  data: Reading[];
  width: number;
  height: number;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const paddingLeft = 30,
    paddingRight = 6,
    paddingTop = 8,
    paddingBottom = 20;
  const x0 = data[0].ts,
    x1 = data[data.length - 1].ts;
  const yMax = Math.max(5, ...data.map((d) => d.current)) * 1.15;
  const scaleX = (ts: number) => paddingLeft + ((ts - x0) / (x1 - x0 || 1)) * (width - paddingLeft - paddingRight);
  const scaleY = (v: number) => height - paddingBottom - (v / yMax) * (height - paddingTop - paddingBottom);

  const svgPoints = data.map((d) => `${scaleX(d.ts).toFixed(1)},${scaleY(d.current).toFixed(1)}`);
  const line = "M" + svgPoints.join("L");
  const area = `${line}L${scaleX(x1).toFixed(1)},${(height - paddingBottom).toFixed(1)}L${scaleX(x0).toFixed(1)},${(height - paddingBottom).toFixed(1)}Z`;

  const yTicks = [0, Math.round(yMax / 2 / 5) * 5, Math.round((yMax / 5) * 0.8) * 5].filter(
    (v, i, a) => a.indexOf(v) === i && v > 0,
  );
  const xTicks = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4);

  // Multi-day windows (7d/30d) read better as dates; tight windows as weekday+time.
  const spanDays = (x1 - x0) / 86_400_000;
  const fmt = (ts: number) =>
    spanDays > 3
      ? new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : new Date(ts).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const hoveredReading = hover != null ? data[hover] : null;
  const hoverX = hoveredReading ? scaleX(hoveredReading.ts) : 0;

  // Nearest point to a client X (binary search over ts). Shared by mouse + touch.
  function locate(clientX: number, rect: DOMRect) {
    const t = x0 + ((clientX - rect.left - paddingLeft) / (width - paddingLeft - paddingRight)) * (x1 - x0);
    let lo = 0,
      hi = data.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      data[m].ts < t ? (lo = m + 1) : (hi = m);
    }
    setHover(lo);
  }
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => locate(e.clientX, e.currentTarget.getBoundingClientRect());
  const onTouch = (e: React.TouchEvent<SVGSVGElement>) =>
    locate(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());

  return (
    <>
      <svg
        width={width}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onTouch}
        onTouchMove={onTouch}
        style={{ touchAction: "none" }}
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id="trendFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="var(--chart-line)"
              stopOpacity={0.22}
            />
            <stop
              offset="100%"
              stopColor="var(--chart-line)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={scaleY(v)}
              y2={scaleY(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={paddingLeft - 6}
              y={scaleY(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((ts, i) => (
          <text
            key={i}
            x={scaleX(ts)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            className="fill-muted-foreground text-[10px]"
          >
            {fmt(ts)}
          </text>
        ))}
        <path
          d={area}
          fill="url(#trendFill)"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoveredReading && (
          <g>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={paddingTop}
              y2={height - paddingBottom}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <circle
              cx={hoverX}
              cy={scaleY(hoveredReading.current)}
              r={3.5}
              fill="var(--chart-line)"
              stroke="var(--background)"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
      {hoveredReading && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: Math.min(Math.max(hoverX, 48), width - 48), top: 2 }}
        >
          <span className="font-semibold tabular-nums">{hoveredReading.current}</span>
          <span className="ml-1 text-muted-foreground">{fmt(hoveredReading.ts)}</span>
        </div>
      )}
    </>
  );
}
