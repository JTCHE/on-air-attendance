import { insertReadings } from "./db";
import clubs from "./clubs.json";

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "app-version": "10.14.0",
  bundleid: "com.clubconnect.libertygymstgilles",
  platform: "ios-react",
  locale: "fr-FR",
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "ClubConnect/710180 CFNetwork/3860.600.12 Darwin/25.5.0",
});

const shuffle = <T>(a: T[]) =>
  a
    .map((v) => [Math.random(), v] as const)
    .sort((x, y) => x[0] - y[0])
    .map((p) => p[1]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll every club's attendance and store one row each.
 * Shuffled order + jittered concurrency keeps it polite; the endpoint is
 * CDN-cached ~267s so anything finer than ~5min just reads the same value.
 */
export async function pollAll(token: string, { concurrency = 8 } = {}) {
  const ts = Date.now();
  const queue = shuffle([...clubs]);
  const rows: { clubId: string; current: number; max: number | null }[] = [];
  const tally = { ok: 0, noCounter: 0, failed: 0 }; // 200+data / 204 / other
  let unauthorized = false;

  async function worker() {
    while (queue.length) {
      const club = queue.shift()!;
      await sleep(Math.random() * 300);
      try {
        const res = await fetch(`https://mobile.clubconnect.fr/api/mobile/attendance/${club.id}`, { headers: HEADERS(token) });
        if (res.status === 401) {
          unauthorized = true;
          queue.length = 0;
          return;
        }
        if (res.status === 204) {
          tally.noCounter++;
          continue;
        } // no live counter right now
        if (res.status !== 200) {
          tally.failed++;
          console.warn(`  ✗ ${club.name} (${club.id}) → HTTP ${res.status}`);
          continue;
        }
        const { current, max } = JSON.parse(await res.text()) as { current: number; max: number | null };
        if (typeof current !== "number") {
          tally.noCounter++;
          continue;
        }
        rows.push({ clubId: club.id, current, max: max ?? null });
        console.log(`  ✓ ${club.name} (${club.id}) → ${current}${max ? `/${max}` : ""}`);
        tally.ok++;
      } catch (err) {
        tally.failed++;
        console.warn(`  ✗ ${club.name} (${club.id}) → ${err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (unauthorized) throw new Error("401 — refresh CLUBCONNECT_TOKEN");
  await insertReadings(ts, rows);
  console.log(`poll: ${tally.ok} stored · ${tally.noCounter} no-counter · ${tally.failed} failed (of ${clubs.length})`);
  return rows.length;
}
