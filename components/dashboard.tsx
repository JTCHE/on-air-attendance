"use client";
import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Club } from "@/lib/clubs";
import type { Reading, Baseline } from "@/lib/db";
import { GymSwitcher } from "@/components/gym-switcher";
import { TrendChart } from "@/components/trend-chart";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() order, Mon-first

function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000) | 0;
  return s < 90 ? `${s}s ago` : s < 3600 ? `${(s / 60) | 0}m ago` : `${(s / 3600) | 0}h ago`;
}

type Props = { club: Club; latest: Reading | null; recent: Reading[]; baseline: Baseline[]; total: number };

export function Dashboard({ club, latest, recent, baseline }: Props) {
  const router = useRouter();

  // Remember last club + live refresh via RSC re-fetch (soft, no full reload).
  useEffect(() => {
    document.cookie = `club=${club.id}; path=/; max-age=31536000; samesite=lax`;
  }, [club.id]);
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

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
    <main className="flex h-dvh flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <header className="flex  items-baseline justify-between">
        <GymSwitcher current={club} />
      </header>

      {/* The headline number — the one thing this page exists to show. */}
      <section className="flex items-end gap-5">
        <div className="flex items-end gap-3">
          <span className="text-7xl font-bold leading-none tabular-nums tracking-tighter">{latest?.current ?? "—"}</span>
          <div className="pb-1">
            <div className="text-xs text-muted-foreground">{latest ? `updated ${ago(latest.ts)}` : "no data"}</div>
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

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 grid-rows-1">
        <div className=" flex min-h-0 flex-col">
          <h2 className="label px-1 pb-2">Last 48 hours</h2>
          <div className="min-h-0 flex-1">
            <TrendChart data={recent} />
          </div>
        </div>
        {/* <div className="panel flex min-h-0 flex-col p-3">
          <h2 className="label px-1 pb-2">Weekly rhythm</h2>
          <div className="min-h-0 flex-1">
            <Heatmap club={club} baseline={baseline} now={now} />
          </div>
        </div> */}
      </section>
    </main>
  );
}

function Heatmap({ club, baseline, now }: { club: Club; baseline: Baseline[]; now: Date }) {
  if (!baseline.length)
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">Building baseline as data collects…</div>
    );

  const map = new Map(baseline.map((b) => [b.weekday * 24 + b.hour, b.avg]));
  const maxAvg = baseline.reduce((m, b) => Math.max(m, b.avg), 0);
  // Open hours from the club directory; fall back to the span we actually have data for.
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
        <div
          key={d}
          className="text-center"
        >
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
