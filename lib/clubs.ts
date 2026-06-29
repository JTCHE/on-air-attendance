import data from "./clubs.json";

export type Club = { id: string; name: string; openingHours?: [number, number]; timeZone?: string };
export const clubs = data as Club[];
export const getClub = (id: string) => clubs.find((c) => c.id === id);
export const DEFAULT_CLUB = "9eM6en7UzJ"; // ON AIR Montpellier Celleneuve

// Returns the DateRange for the gym-local calendar day that contains referenceMs.
// Uses Intl.DateTimeFormat so it's correct for any timezone and DST transitions.
export function gymDayRange(
  referenceMs: number,
  timeZone: string,
  openingHours?: [number, number],
): { startTimestamp: number; endTimestamp: number; fullDayEndTimestamp: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  }).formatToParts(new Date(referenceMs));
  const get = (type: string) => +parts.find((p) => p.type === type)!.value;
  const [year, month, day, hour, minute, second] = [get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")];
  // Gym UTC offset (whole minutes — all modern timezone offsets are)
  const gymOffset = Math.round((Date.UTC(year, month, day, hour, minute, second) - referenceMs) / 60_000) * 60_000;
  const utcMidnight = Date.UTC(year, month, day) - gymOffset;
  const openMs = (openingHours?.[0] ?? 6) * 3_600_000;
  const closeMs = (openingHours?.[1] ?? 23) * 3_600_000;
  return {
    startTimestamp: utcMidnight + openMs,
    endTimestamp: Math.min(utcMidnight + closeMs, referenceMs < Date.now() ? Date.now() : referenceMs),
    fullDayEndTimestamp: utcMidnight + closeMs,
  };
}

export function gymUtcOffset(timeZone = "Europe/Paris"): string {
  const now = Date.now();
  const localTime = new Date(new Date(now).toLocaleString("en-US", { timeZone }));
  const utcTime = new Date(new Date(now).toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMinutes = Math.round((localTime.getTime() - utcTime.getTime()) / 60_000);
  const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const offsetMins = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
  return `${offsetMinutes >= 0 ? "+" : "-"}${offsetHours}:${offsetMins}`;
}
