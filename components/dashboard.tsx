"use client";
import { useCallback, useEffect, useState } from "react";
import { getClub, type Club } from "@/lib/clubs";
import type { ClubData, SnapshotWithHistory } from "@/lib/db";
import { useClubData, type DateRange } from "@/lib/use-club-data";
import { GymSwitcher } from "@/components/gym-switcher";
import { Hero } from "@/components/hero";
import { TrendChart } from "@/components/trend-chart";
import { DayPicker } from "@/components/day-picker";
import { AllView } from "@/components/all-view";

export function Dashboard({
  club: initialClub,
  initial,
  initialDateRange,
  active,
}: {
  club: Club;
  initial: ClubData;
  initialDateRange: DateRange;
  active: SnapshotWithHistory[];
}) {
  const [clubId, setClubId] = useState(initialClub.id);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [showAll, setShowAll] = useState(false);
  const club = getClub(clubId) ?? initialClub;
  const { data, loading } = useClubData(clubId, dateRange, club.timeZone, initial);

  const gymLocalTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: club.timeZone ?? "Europe/Paris" }),
  );

  // Optimistic switch: header label + title flip instantly, data catches up via
  // the route-handler fetch. No RSC navigation, so it never blocks on the DB.
  // pushState (not replace) so the browser back button returns to the prior gym.
  const apply = useCallback(
    (id: string) => {
      setShowAll(false);
      setClubId(id);
      // Reset to today's range for the new club
      setDateRange(initialDateRange);
      document.cookie = `club=${id}; path=/; max-age=31536000; samesite=lax`;
      const c = getClub(id);
      if (c) document.title = `${c.name} | Occupation`;
    },
    [initialDateRange],
  );

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
            gymLocalTime={gymLocalTime}
            openingHours={club.openingHours}
            loading={loading}
          />

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-1 pb-2">
              {/* <h2 className="label">Attendance</h2> */}
              <DayPicker
                timeZone={club.timeZone}
                openingHours={club.openingHours}
                dateRange={dateRange}
                onChange={setDateRange}
              />
            </div>
            <div className="min-h-0 flex-1">
              <TrendChart
                data={data.recent}
                timeZone={club.timeZone}
                xDomain={[dateRange.startTimestamp, dateRange.fullDayEndTimestamp ?? dateRange.endTimestamp]}
                baseline={data.baseline}
                gymLocalWeekday={gymLocalTime.getDay()}
                currentTimestamp={Date.now()}
                loading={loading}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
