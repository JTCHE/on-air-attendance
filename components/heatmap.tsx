import { Fragment } from "react";
import type { Club } from "@/lib/clubs";
import type { Baseline } from "@/lib/db";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() order, Mon-first

// ponytail: kept intact but not currently rendered — user disliked it, may
// reintroduce later. Days as columns, open hours (from club.h) as rows.
export function Heatmap({ club, baseline, now }: { club: Club; baseline: Baseline[]; now: Date }) {
  if (!baseline.length)
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">Building baseline as data collects…</div>
    );

  const map = new Map(baseline.map((b) => [b.weekday * 24 + b.hour, b.avg]));
  const maxAvg = baseline.reduce((m, b) => Math.max(m, b.avg), 0);
  const seen = baseline.map((b) => b.hour);
  const lo = club.h ? club.h[0] : Math.min(...seen);
  const hi = Math.min(23, club.h ? club.h[1] : Math.max(...seen));
  const hours = Array.from({ length: Math.max(1, hi - lo + 1) }, (_, i) => lo + i);

  return (
    <div
      className="grid h-full gap-0.5 text-[10px] text-muted-foreground"
      style={{
        gridTemplateColumns: `1.6rem repeat(7, minmax(0,1fr))`,
        gridTemplateRows: `0.75rem repeat(${hours.length}, minmax(0,1fr))`,
      }}
    >
      <div />
      {DAYS.map((d) => (
        <div key={d} className="text-center">
          {d}
        </div>
      ))}
      {hours.map((h) => (
        <Fragment key={h}>
          <div className="flex items-center justify-end pr-1 tabular-nums">{h}</div>
          {DAY_IDX.map((wd) => {
            const v = map.get(wd * 24 + h);
            const t = v != null && maxAvg > 0 ? v / maxAvg : null;
            const isNow = wd === now.getDay() && h === now.getHours();
            return (
              <div
                key={wd}
                title={v != null ? `${DAYS[DAY_IDX.indexOf(wd)]} ${h}:00 · ${Math.round(v)} avg` : undefined}
                className={`min-h-2 rounded-[3px] ${isNow ? "ring-1 ring-foreground" : ""}`}
                style={{
                  backgroundColor:
                    t == null ? "var(--secondary)" : `color-mix(in oklab, var(--busy) ${Math.round(t * 100)}%, var(--secondary))`,
                }}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
