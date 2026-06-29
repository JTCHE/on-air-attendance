"use client";
import { useEffect, useState } from "react";
import { getClub } from "@/lib/clubs";
import type { SnapshotWithHistory } from "@/lib/db";
import { cn } from "@/lib/utils";

export function AllView({ initial, onSelect }: { initial: SnapshotWithHistory[]; onSelect: (id: string) => void }) {
  const [clubs, setClubs] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/active", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setClubs(d))
        .catch(() => {});
    const iv = setInterval(load, 90_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {clubs.map((c) => (
          <GymCard
            key={c.id}
            snap={c}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function GymCard({ snap, onSelect }: { snap: SnapshotWithHistory; onSelect: (id: string) => void }) {
  const name = getClub(snap.id)?.name ?? snap.id;
  const pct = snap.max ? Math.round((snap.current / snap.max) * 100) : null;
  return (
    <button
      onClick={() => onSelect(snap.id)}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-foreground/25"
    >
      <div className="truncate text-xs font-medium text-muted-foreground">{name}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold leading-none tabular-nums tracking-tighter">{snap.current}</span>
        {pct != null && (
          <span className={cn("text-xs tabular-nums", pct >= 80 ? "text-busy" : "text-muted-foreground")}>{pct}%</span>
        )}
      </div>
      <Sparkline data={snap.history} />
      {snap.max != null && (
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full", pct! >= 80 ? "bg-busy" : "bg-chart-line")}
            style={{ width: `${Math.min(100, pct!)}%` }}
          />
        </div>
      )}
    </button>
  );
}

function Sparkline({ data }: { data: { ts: number; current: number }[] }) {
  if (data.length < 2) return <div className="h-6" />;
  const W = 100,
    H = 24;
  const x0 = data[0].ts,
    x1 = data[data.length - 1].ts;
  const vals = data.map((d) => d.current);
  const y0 = Math.min(...vals),
    y1 = Math.max(...vals);
  const px = (t: number) => (x1 === x0 ? W / 2 : ((t - x0) / (x1 - x0)) * W);
  const py = (v: number) => (y1 === y0 ? H / 2 : H - ((v - y0) / (y1 - y0)) * H);
  const pts = data.map((d) => `${px(d.ts)},${py(d.current)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-chart-line)"
        strokeWidth=".75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
