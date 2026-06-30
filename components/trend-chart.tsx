"use client";
import { useEffect, useRef, useState } from "react";
import type { Reading, Baseline } from "@/lib/db";

// Hand-rolled SVG so there's no chart-lib resize loop. Measured once per
// container resize (guarded), then pure math — fast and deterministic.
export function TrendChart({
  data,
  timeZone,
  xDomain,
  baseline,
  gymLocalWeekday,
  currentTimestamp,
  loading,
}: {
  data: Reading[];
  timeZone?: string;
  xDomain?: [number, number];
  baseline?: Baseline[];
  gymLocalWeekday?: number;
  currentTimestamp?: number;
  loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(([e]) => {
      const { width: newWidth, height: newHeight } = e.contentRect;
      setSize((s) =>
        Math.abs(s.width - newWidth) < 1 && Math.abs(s.height - newHeight) < 1 ? s : { width: newWidth, height: newHeight },
      );
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
          timeZone={timeZone}
          xDomain={xDomain}
          baseline={baseline}
          gymLocalWeekday={gymLocalWeekday}
          currentTimestamp={currentTimestamp}
          hover={hover}
          setHover={setHover}
        />
      ) : null}
    </div>
  );
}

function zoneColor(score: number): string {
  if (score < 0.4) return "var(--zone-quiet)";
  if (score < 0.7) return "var(--zone-moderate)";
  return "var(--zone-busy)";
}

function Plot({
  data,
  width,
  height,
  timeZone,
  xDomain,
  baseline,
  gymLocalWeekday,
  currentTimestamp,
  hover,
  setHover,
}: {
  data: Reading[];
  width: number;
  height: number;
  timeZone?: string;
  xDomain?: [number, number];
  baseline?: Baseline[];
  gymLocalWeekday?: number;
  currentTimestamp?: number;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const paddingLeft = 30,
    paddingRight = 6,
    paddingTop = 8,
    paddingBottom = 20;

  // When xDomain is provided (single-day mode), use it for the x axis so the
  // chart spans the full opening-hours window even if data doesn't fill it.
  const x0 = xDomain?.[0] ?? data[0].ts;
  const x1 = xDomain?.[1] ?? data[data.length - 1].ts;
  const yMax = Math.max(5, ...data.map((d) => d.current)) * 1.15;
  const scaleX = (ts: number) => paddingLeft + ((ts - x0) / (x1 - x0 || 1)) * (width - paddingLeft - paddingRight);
  const scaleY = (v: number) => height - paddingBottom - (v / yMax) * (height - paddingTop - paddingBottom);

  const svgPoints = data.map((d) => `${scaleX(d.ts).toFixed(1)},${scaleY(d.current).toFixed(1)}`);
  const line = "M" + svgPoints.join("L");
  const area = `${line}L${scaleX(data[data.length - 1].ts).toFixed(1)},${(height - paddingBottom).toFixed(1)}L${scaleX(data[0].ts).toFixed(1)},${(height - paddingBottom).toFixed(1)}Z`;

  const yTicks = [0, Math.round(yMax / 2 / 5) * 5, Math.round((yMax / 5) * 0.8) * 5].filter(
    (v, i, a) => a.indexOf(v) === i && v > 0,
  );
  const xTicks = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4);

  const spanMs = x1 - x0;
  const isSingleDay = spanMs < 25 * 3_600_000;
  const tzOption = timeZone ? { timeZone } : {};
  const fmt = (ts: number) => {
    if (isSingleDay) {
      const hour = new Date(ts).toLocaleString("en-GB", { hour: "numeric", ...tzOption });
      return `${hour}h`;
    }
    return spanMs > 3 * 86_400_000
      ? new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", ...tzOption })
      : new Date(ts).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", ...tzOption });
  };
  const fmtHover = (ts: number) =>
    isSingleDay
      ? new Date(ts).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", ...tzOption })
      : fmt(ts);

  // Prediction zones: future hours in single-day mode with baseline data.
  // Each zone gets a background rect + a flat horizontal line at the baseline avg.
  const predictionZones: { x: number; zoneWidth: number; bgColor: string; lineColor: string; avgY: number }[] = [];
  if (isSingleDay && baseline && gymLocalWeekday != null && currentTimestamp != null && currentTimestamp < x1) {
    const todayBaseline = baseline.filter((s) => s.weekday === gymLocalWeekday);
    const peakDailyAverage = Math.max(1, ...todayBaseline.map((s) => s.avg));
    // Start at the currently active hour (floor, not ceil) so an in-progress
    // period's zone extends back to when it started, not just its future tail.
    const firstFutureHour = Math.floor(currentTimestamp / 3_600_000);
    const lastHour = Math.floor(x1 / 3_600_000);
    for (let hour = firstFutureHour; hour <= lastHour; hour++) {
      const slot = todayBaseline.find((s) => s.hour === hour % 24);
      const score = slot ? slot.avg / peakDailyAverage : 0.5;
      const avg = slot?.avg ?? 0;
      const hourStart = hour * 3_600_000;
      const hourEnd = Math.min((hour + 1) * 3_600_000, x1);
      const color = zoneColor(score);
      predictionZones.push({
        x: scaleX(hourStart),
        zoneWidth: scaleX(hourEnd) - scaleX(hourStart),
        bgColor: color,
        // Flat prediction line uses a more opaque version of the zone color.
        lineColor: score < 0.4 ? "var(--quiet)" : score < 0.7 ? "oklch(0.80 0.15 80)" : "var(--busy)",
        avgY: scaleY(avg),
      });
    }
  }

  const nowLineX =
    isSingleDay && currentTimestamp != null && currentTimestamp >= x0 && currentTimestamp <= x1 ? scaleX(currentTimestamp) : null;

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
  const onTouch = (e: React.TouchEvent<SVGSVGElement>) => locate(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());

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

        {/* Prediction zone backgrounds — drawn before data line so line renders on top */}
        {predictionZones.map(({ x, zoneWidth, bgColor }, i) => (
          <rect
            key={i}
            x={x}
            y={paddingTop}
            width={zoneWidth}
            height={height - paddingTop - paddingBottom}
            fill={bgColor}
          />
        ))}

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
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* "Now" dashed vertical line */}
        {nowLineX != null && (
          <line
            x1={nowLineX}
            x2={nowLineX}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

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
          <span className="ml-1 text-muted-foreground">{fmtHover(hoveredReading.ts)}</span>
        </div>
      )}
    </>
  );
}
