import type { Baseline } from "@/lib/db";

export type Recommendation = {
  label: string;
  tone: "quiet" | "busy" | "neutral";
};

function formatHour(hour: number): string {
  return `${hour}h`;
}

function firstQuietSlot(slots: Baseline[], peak: number): Baseline | undefined {
  return [...slots].sort((a, b) => a.hour - b.hour).find((s) => s.avg / peak < 0.45);
}

function quietRange(slots: Baseline[], startHour: number, peak: number): number {
  // Walk consecutive hours from startHour and return the last quiet one
  let last = startHour;
  for (let h = startHour + 1; h <= startHour + 5; h++) {
    const slot = slots.find((s) => s.hour === h);
    if (!slot || slot.avg / peak >= 0.45) break;
    last = h;
  }
  return last;
}

export function recommend(
  baseline: Baseline[],
  gymLocalWeekday: number,
  gymLocalHour: number,
  openingHours?: [number, number],
): Recommendation {
  const openHour = openingHours?.[0] ?? 6;
  const closeHour = openingHours?.[1] ?? 23;
  // Filter to slots within opening hours only
  const inHours = (s: Baseline) => s.hour >= openHour && s.hour < closeHour;
  const todaySlots = baseline.filter((s) => s.weekday === gymLocalWeekday && inHours(s));
  if (!todaySlots.length) return { label: "", tone: "neutral" };

  const peakToday = Math.max(...todaySlots.map((s) => s.avg));
  if (peakToday === 0) return { label: "", tone: "neutral" };

  const scoreAt = (hour: number) => {
    const slot = todaySlots.find((s) => s.hour === hour);
    return slot ? slot.avg / peakToday : null;
  };

  const currentScore = scoreAt(gymLocalHour);
  if (currentScore != null && currentScore < 0.45) {
    return { label: "Go now", tone: "quiet" };
  }

  // An imminent calm window beats jumping straight to "busy all day".
  const nextScore = scoreAt(gymLocalHour + 1);
  if (nextScore != null && nextScore < 0.45) {
    return { label: "Go in about an hour", tone: "quiet" };
  }

  // Find next quiet window today
  const restOfToday = todaySlots.filter((s) => s.hour > gymLocalHour);
  const quietToday = firstQuietSlot(restOfToday, peakToday);

  if (quietToday) {
    const rangeEnd = quietRange(restOfToday, quietToday.hour, peakToday);
    const label =
      rangeEnd > quietToday.hour
        ? `Go between ${formatHour(quietToday.hour)} and ${formatHour(rangeEnd + 1)}`
        : `Go at ${formatHour(quietToday.hour)}`;
    return { label, tone: "busy" };
  }

  // Nothing quiet left today — check tomorrow only, never further out.
  const tomorrowWeekday = (gymLocalWeekday + 1) % 7;
  const tomorrowSlots = baseline.filter((s) => s.weekday === tomorrowWeekday && inHours(s));
  if (tomorrowSlots.length) {
    const peakTomorrow = Math.max(1, ...tomorrowSlots.map((s) => s.avg));
    const quietTomorrow = firstQuietSlot(tomorrowSlots, peakTomorrow);
    if (quietTomorrow) {
      return { label: `Go tomorrow at ${formatHour(quietTomorrow.hour)}`, tone: "busy" };
    }
  }

  return { label: "", tone: "neutral" };
}
