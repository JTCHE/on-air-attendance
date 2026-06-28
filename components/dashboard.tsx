"use client";
import { useCallback, useState } from "react";
import { getClub, type Club } from "@/lib/clubs";
import type { ClubData } from "@/lib/db";
import { useClubData } from "@/lib/use-club-data";
import { GymSwitcher } from "@/components/gym-switcher";
import { Hero } from "@/components/hero";
import { TrendChart } from "@/components/trend-chart";
import { Timeframe } from "@/components/timeframe";

export function Dashboard({ club: initialClub, initial }: { club: Club; initial: ClubData }) {
  const [clubId, setClubId] = useState(initialClub.id);
  const [hours, setHours] = useState(48);
  const { data, loading } = useClubData(clubId, hours, initial);
  const club = getClub(clubId) ?? initialClub;

  // Optimistic switch: header label + title flip instantly, data catches up via
  // the route-handler fetch. No RSC navigation, so it never blocks on the DB.
  const switchClub = useCallback((id: string) => {
    setClubId(id);
    document.cookie = `club=${id}; path=/; max-age=31536000; samesite=lax`;
    window.history.replaceState(null, "", `/${id}`);
    const c = getClub(id);
    if (c) document.title = `${c.name} | Occupation`;
  }, []);

  return (
    <main className="flex h-dvh flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center">
        <span className="label">Occupation</span>
        <div className="justify-self-center">
          <GymSwitcher current={club} onSelect={switchClub} />
        </div>
      </header>

      <Hero latest={data.latest} baseline={data.baseline} loading={loading} />

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="label">Attendance</h2>
          <Timeframe hours={hours} onChange={setHours} />
        </div>
        <div className="min-h-0 flex-1">
          <TrendChart data={data.recent} loading={loading} />
        </div>
      </section>
    </main>
  );
}
