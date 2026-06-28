"use client";
import { useCallback, useEffect, useState } from "react";
import { getClub, type Club } from "@/lib/clubs";
import type { ClubData, SnapshotWithHistory } from "@/lib/db";
import { useClubData } from "@/lib/use-club-data";
import { GymSwitcher } from "@/components/gym-switcher";
import { Hero } from "@/components/hero";
import { TrendChart } from "@/components/trend-chart";
import { Timeframe } from "@/components/timeframe";
import { AllView } from "@/components/all-view";

export function Dashboard({ club: initialClub, initial, active }: { club: Club; initial: ClubData; active: SnapshotWithHistory[] }) {
  const [clubId, setClubId] = useState(initialClub.id);
  const [hours, setHours] = useState(48);
  const [showAll, setShowAll] = useState(false);
  const { data, loading } = useClubData(clubId, hours, initial);
  const club = getClub(clubId) ?? initialClub;

  // Optimistic switch: header label + title flip instantly, data catches up via
  // the route-handler fetch. No RSC navigation, so it never blocks on the DB.
  // pushState (not replace) so the browser back button returns to the prior gym.
  const apply = useCallback((id: string) => {
    setShowAll(false);
    setClubId(id);
    document.cookie = `club=${id}; path=/; max-age=31536000; samesite=lax`;
    const c = getClub(id);
    if (c) document.title = `${c.name} | Occupation`;
  }, []);

  const switchClub = useCallback(
    (id: string) => {
      if (id === clubId) return;
      window.history.pushState(null, "", `/${id}`);
      apply(id);
    },
    [clubId, apply],
  );

  // Back/forward: sync the selected club from the URL the browser restored.
  useEffect(() => {
    const onPop = () => apply(location.pathname.slice(1) || initialClub.id);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [apply, initialClub.id]);

  return (
    <main className="flex h-dvh flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center">
        <GymSwitcher
          current={club}
          activeIds={active.map((s) => s.id)}
          onSelect={switchClub}
          onShowAll={() => setShowAll((v) => !v)}
          showAll={showAll}
          loading={loading}
        />
      </header>

      {showAll ? (
        <AllView
          initial={active}
          onSelect={switchClub}
        />
      ) : (
        <>
          <Hero
            latest={data.latest}
            baseline={data.baseline}
            loading={loading}
          />

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="label">Attendance</h2>
              <Timeframe
                hours={hours}
                onChange={setHours}
              />
            </div>
            <div className="min-h-0 flex-1">
              <TrendChart
                data={data.recent}
                loading={loading}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
