import { cn } from "@/lib/utils";
import type { Reading, Baseline } from "@/lib/db";
import { recommend } from "@/lib/predict";

function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000) | 0;
  return s < 90 ? `${s}s ago` : s < 3600 ? `${(s / 60) | 0}m ago` : `${(s / 3600) | 0}h ago`;
}

export function Hero({
  latest,
  baseline,
  gymLocalTime,
  openingHours,
  loading,
}: {
  latest: Reading | null;
  baseline: Baseline[];
  gymLocalTime: Date;
  openingHours?: [number, number];
  loading: boolean;
}) {
  const usual = baseline.find((b) => b.weekday === gymLocalTime.getDay() && b.hour === gymLocalTime.getHours());
  const typical = usual ? Math.round(usual.avg) : null;
  const delta = latest && usual ? latest.current - usual.avg : null;
  const pct = delta != null && usual && usual.avg > 0 ? Math.round((delta / usual.avg) * 100) : null;

  // Only surface the ±% line if the difference is meaningful (≥ 20 %)
  const showPct = pct != null && Math.abs(pct) >= 20;
  const tone = showPct ? (delta! >= 0 ? "text-busy" : "text-quiet") : "";
  const context =
    typical == null
      ? ""
      : showPct
        ? `${Math.abs(pct!)}% ${delta! >= 0 ? "busier" : "quieter"} than usual · typically ${typical}`
        : null;

  const capacityPct = latest?.max ? Math.round((latest.current / latest.max) * 100) : null;

  const recommendation = recommend(baseline, gymLocalTime.getDay(), gymLocalTime.getHours(), openingHours);

  return (
    <section className={cn("flex flex-col gap-2 transition-opacity", loading && "opacity-40")}>
      {recommendation.label && (
        <p
          className={cn(
            "text-3xl font-bold leading-none tracking-tighter",
            recommendation.tone === "quiet" && "gradient-text-quiet",
            recommendation.tone === "busy" && "gradient-text-busy",
          )}
        >
          {recommendation.label}
        </p>
      )}
      <div className="flex items-end gap-5">
        <div className="flex items-end gap-3">
          <span className="text-7xl font-bold leading-none tabular-nums tracking-tighter">{latest?.current ?? "—"}</span>
          <div className="pb-1">
            <div
              className="text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {latest ? `updated ${ago(latest.ts)}` : "no data"}
            </div>
            <div className="text-sm font-medium">{latest?.current ? "people right now" : ""}</div>
            <div className={`text-sm ${tone || "text-muted-foreground"}`}>{context}</div>
          </div>
        </div>
        {capacityPct != null && (
          <div className="ml-auto pb-1 text-right">
            <div className={`text-3xl font-semibold tabular-nums tracking-tight ${capacityPct >= 80 ? "text-busy" : ""}`}>
              {capacityPct}%
            </div>

            <div className="text-xs text-muted-foreground">{latest!.max! - latest!.current} spots free</div>
          </div>
        )}
      </div>
    </section>
  );
}
