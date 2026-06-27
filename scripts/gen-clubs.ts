// Regenerate lib/clubs.json from a captured /api/mobile/club HAR.
// Usage: bun scripts/gen-clubs.ts <club_list.har>
// Strips the shared "ON AIR" brand prefix and extracts open/close hours so the
// heatmap can hide the hours each club is shut.

import { readFileSync, writeFileSync } from "node:fs";

const har = JSON.parse(readFileSync(process.argv[2] ?? "logs/club_list.har", "utf8"));
const c = har.log.entries[0].response.content;
const raw = c.encoding === "base64" ? Buffer.from(c.text, "base64").toString("utf8") : c.text;

// openingHours is one wildly-inconsistent string per weekday ("06h00 - 23h00",
// "8h-22h", "7:00 - 22:00", "6h23H"...). Pull the hour off each "Nh"/"N:" token,
// first = open, last = close. 0 or past-midnight closes count as 24 (display caps at 23).
function hours(days?: string[]): [number, number] | undefined {
  const opens: number[] = [], closes: number[] = [];
  for (const d of days ?? []) {
    const ns = [...d.matchAll(/(\d{1,2})\s*[h:]/gi)].map((m) => +m[1]).filter((n) => n <= 24);
    if (ns.length < 2) continue;
    opens.push(ns[0]);
    const close = ns[ns.length - 1];
    closes.push(close === 0 || close < ns[0] ? 24 : close);
  }
  return opens.length ? [Math.min(...opens), Math.min(24, Math.max(...closes))] : undefined;
}

type Raw = { id: string; name?: string; active?: boolean; openingHours?: string[] };
const clubs = (JSON.parse(raw) as Raw[])
  .filter((x) => x.active !== false && x.name)
  .map((x) => {
    const h = hours(x.openingHours);
    return { id: x.id, name: x.name!.replace(/^ON AIR\s+/i, "").trim(), ...(h && { h }) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync("lib/clubs.json", JSON.stringify(clubs));
console.log(`wrote ${clubs.length} clubs, ${clubs.filter((c) => "h" in c).length} with hours`);
