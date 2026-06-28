"use client";
import { useEffect, useRef, useState } from "react";
import type { Reading } from "@/lib/db";

// Hand-rolled SVG so there's no chart-lib resize loop. Measured once per
// container resize (guarded), then pure math — fast and deterministic.
export function TrendChart({ data, loading }: { data: Reading[]; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative h-full w-full transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {data.length < 2 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Not enough data yet</div>
      ) : w > 0 && h > 0 ? (
        <Plot
          data={data}
          w={w}
          h={h}
          hover={hover}
          setHover={setHover}
        />
      ) : null}
    </div>
  );
}

function Plot({
  data,
  w,
  h,
  hover,
  setHover,
}: {
  data: Reading[];
  w: number;
  h: number;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const padL = 30,
    padR = 6,
    padT = 8,
    padB = 20;
  const x0 = data[0].ts,
    x1 = data[data.length - 1].ts;
  const yMax = Math.max(5, ...data.map((d) => d.current)) * 1.15;
  const sx = (ts: number) => padL + ((ts - x0) / (x1 - x0 || 1)) * (w - padL - padR);
  const sy = (v: number) => h - padB - (v / yMax) * (h - padT - padB);

  const pts = data.map((d) => `${sx(d.ts).toFixed(1)},${sy(d.current).toFixed(1)}`);
  const line = "M" + pts.join("L");
  const area = `${line}L${sx(x1).toFixed(1)},${(h - padB).toFixed(1)}L${sx(x0).toFixed(1)},${(h - padB).toFixed(1)}Z`;

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

  const hd = hover != null ? data[hover] : null;
  const hx = hd ? sx(hd.ts) : 0;

  // Nearest point to a client X (binary search over ts). Shared by mouse + touch.
  function locate(clientX: number, rect: DOMRect) {
    const t = x0 + ((clientX - rect.left - padL) / (w - padL - padR)) * (x1 - x0);
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
        width={w}
        height={h}
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
              x1={padL}
              x2={w - padR}
              y1={sy(v)}
              y2={sy(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={sy(v) + 3}
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
            x={sx(ts)}
            y={h - 6}
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
        {hd && (
          <g>
            <line
              x1={hx}
              x2={hx}
              y1={padT}
              y2={h - padB}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <circle
              cx={hx}
              cy={sy(hd.current)}
              r={3.5}
              fill="var(--chart-line)"
              stroke="var(--background)"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
      {hd && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: Math.min(Math.max(hx, 48), w - 48), top: 2 }}
        >
          <span className="font-semibold tabular-nums">{hd.current}</span>
          <span className="ml-1 text-muted-foreground">{fmt(hd.ts)}</span>
        </div>
      )}
    </>
  );
}
