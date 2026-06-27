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
  let unauthorized = false;

  async function worker() {
    while (queue.length) {
      const club = queue.shift()!;
      await sleep(Math.random() * 300);
      try {
        console.log(`trying to poll ${club.name} (${club.id})...`);
        const res = await fetch(`https://mobile.clubconnect.fr/api/mobile/attendance/${club.id}`, { headers: HEADERS(token) });
        if (res.status === 401) {
          unauthorized = true;
          queue.length = 0;
          return;
        }
        if (res.status !== 200) {
          console.error(`poll failed for ${club.name} (${club.id}): ${res.status}`);
          continue;
        }
        const body = await res.text();
        if (!body) continue;
        const { current, max } = JSON.parse(body) as { current: number; max: number | null };
        if (typeof current === "number") rows.push({ clubId: club.id, current, max: max ?? null });
        console.log(`poll successful for ${club.name} (${club.id}): ${current}${max ? `/${max}` : ""}`);
      } catch (err) {
        console.error(`poll failed for ${club.name} (${club.id}): ${err}`);
        /* skip this club this round */
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (unauthorized) throw new Error("401 — refresh CLUBCONNECT_TOKEN");
  await insertReadings(ts, rows);
  return rows.length;
}
