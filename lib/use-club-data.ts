"use client";
import { useEffect, useRef, useState } from "react";
import type { ClubData } from "@/lib/db";

// Client-side data feed: seeded by the server render, then kept live by polling
// the route handler. Replaces the old blanket router.refresh() — switching club
// or timeframe just changes the key, and background refreshes update in place
// without remounting (chart hover, scroll, etc. survive).
export function useClubData(clubId: string, hours: number, initial: ClubData) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false); // first run already has the SSR data

  useEffect(() => {
    let alive = true;
    const fresh = mounted.current; // any clubId/hours change after mount = refetch
    mounted.current = true;
    if (fresh) setLoading(true);

    const load = async (silent: boolean) => {
      try {
        const r = await fetch(`/api/club/${clubId}?h=${hours}`, { cache: "no-store" });
        if (r.ok && alive) setData(await r.json());
      } catch {
        /* keep last good data */
      } finally {
        if (alive && !silent) setLoading(false);
      }
    };

    if (fresh) load(false);
    const iv = setInterval(() => load(true), 90_000);
    const onVis = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [clubId, hours]);

  return { data, loading };
}
