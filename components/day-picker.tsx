"use client";
import { cn } from "@/lib/utils";
import { gymDayRange } from "@/lib/clubs";
import type { DateRange } from "@/lib/use-club-data";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function DayPicker({
  timeZone,
  openingHours,
  dateRange,
  onChange,
}: {
  timeZone: string | undefined;
  openingHours: [number, number] | undefined;
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const tz = timeZone ?? "Europe/Paris";
  const now = Date.now();

  // Reference timestamps for the 7 days ending today (noon-ish to avoid DST edge cases)
  const dayRefs = Array.from({ length: 7 }, (_, i) => now - (6 - i) * 86_400_000);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  const days = dayRefs.map((ref) => {
    const parts = dateFmt.formatToParts(new Date(ref));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
    const weekday = get("weekday"); // "Mon", "Tue", etc.
    const dayNum = +get("day");
    const range = gymDayRange(ref, tz, openingHours);
    return { ref, dateStr, weekday, dayNum, range };
  });

  const todayDateStr = (() => {
    const parts = dateFmt.formatToParts(new Date(now));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  })();

  const activeIndex = days.findIndex((d) => d.range.startTimestamp === dateRange.startTimestamp);

  return (
    <div className="flex w-full justify-between">
      {days.map(({ dateStr, weekday, dayNum, range }, i) => {
        const isToday = dateStr === todayDateStr;
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            onClick={() => onChange(range)}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 py-2 transition-colors -m-10 p-10",
              isActive ? "text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60",
            )}
          >
            <span className={cn("text-[10px] tracking-wide uppercase", isActive ? "font-bold" : "font-medium")}>
              {weekday.toUpperCase()}
            </span>
            <span className={cn("leading-none tabular-nums")}>{dayNum}</span>
          </button>
        );
      })}
    </div>
  );
}
