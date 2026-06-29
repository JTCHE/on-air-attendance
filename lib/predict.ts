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

  const currentSlot = todaySlots.find((s) => s.hour === gymLocalHour);
  const currentScore = currentSlot ? currentSlot.avg / peakToday : 0.5;

  if (currentScore < 0.45) {
    return { label: "Go now", tone: "quiet" };
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

  // Nothing quiet today — scan forward through days that have baseline data
  const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const weekday = (gymLocalWeekday + daysAhead) % 7;
    const daySlots = baseline.filter((s) => s.weekday === weekday && inHours(s));
    if (!daySlots.length) continue;
    const peakDay = Math.max(1, ...daySlots.map((s) => s.avg));
    const quietSlot = firstQuietSlot(daySlots, peakDay);
    if (!quietSlot) continue;
    const when = daysAhead === 1 ? "tomorrow" : WEEKDAY_NAMES[weekday];
    return { label: `Go ${when} at ${formatHour(quietSlot.hour)}`, tone: "busy" };
  }

  return { label: "", tone: "neutral" };
}
