import { cn } from "@/lib/utils";
import type { Reading, Baseline } from "@/lib/db";

function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000) | 0;
  return s < 90 ? `${s}s ago` : s < 3600 ? `${(s / 60) | 0}m ago` : `${(s / 3600) | 0}h ago`;
}

// The one thing this page exists to show: the live headcount, with how it
// compares to a typical slot folded into a single line (no "vs usual" card).
export function Hero({ latest, baseline, loading }: { latest: Reading | null; baseline: Baseline[]; loading: boolean }) {
  const now = new Date();
  const usual = baseline.find((b) => b.weekday === now.getDay() && b.hour === now.getHours());
  const typical = usual ? Math.round(usual.avg) : null;
  const delta = latest && usual ? latest.current - usual.avg : null;
  const pct = delta != null && usual && usual.avg > 0 ? Math.round((delta / usual.avg) * 100) : null;
  const tone = delta == null ? "" : delta >= 5 ? "text-busy" : delta <= -5 ? "text-quiet" : "";
  const context =
    typical == null
      ? ""
      : pct == null
        ? `typically ${typical}`
        : `${Math.abs(pct)}% ${delta! >= 0 ? "busier" : "quieter"} than usual · typically ${typical}`;
  const capacityPct = latest?.max ? Math.round((latest.current / latest.max) * 100) : null;

  return (
    <section className={cn("flex items-end gap-5 transition-opacity", loading && "opacity-40")}>
      <div className="flex items-end gap-3">
        <span className="text-7xl font-bold leading-none tabular-nums tracking-tighter">{latest?.current ?? "—"}</span>
        <div className="pb-1">
          {/* Time-relative: server and client render seconds apart by design. */}
          <div className="text-xs text-muted-foreground" suppressHydrationWarning>
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
    </section>
  );
}
