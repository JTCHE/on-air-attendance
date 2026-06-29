import type { Client } from "@libsql/client";

const URL = process.env.TURSO_URL ?? "file:gym.db";

// Pick the client by URL scheme: node build for local file:, web build for
// Turso (libsql:/https:) so Netlify Lambda never loads native bindings.
// ponytail: dynamic import keeps the node client out of the prod runtime path.
async function connect(): Promise<Client> {
  const { createClient } = URL.startsWith("file:")
    ? await import("@libsql/client")
    : await import("@libsql/client/web");
  const db = createClient({ url: URL, authToken: process.env.TURSO_AUTH_TOKEN });
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
      ts       INTEGER NOT NULL,
      club_id  TEXT NOT NULL DEFAULT '9eM6en7UzJ',
      current  INTEGER NOT NULL,
      max      INTEGER
    )
  `);
  const cols = (await db.execute("PRAGMA table_info(attendance)")).rows.map((r) => ({ name: String(r.name), pk: Number(r.pk) }));
  // The original table had `ts` as PRIMARY KEY. Every poll cycle writes one
  // shared ts across all clubs, so that PK silently dropped all but the first
  // club each cycle. Rebuild without it (preserving rows) — the real fix for
  // "only Celleneuve ever gets data".
  if (cols.some((c) => c.name === "ts" && c.pk > 0)) {
    await db.batch([
      `CREATE TABLE attendance_new (
         ts INTEGER NOT NULL, club_id TEXT NOT NULL DEFAULT '9eM6en7UzJ',
         current INTEGER NOT NULL, max INTEGER )`,
      `INSERT INTO attendance_new (ts, club_id, current, max)
         SELECT ts, club_id, current, max FROM attendance`,
      `DROP TABLE attendance`,
      `ALTER TABLE attendance_new RENAME TO attendance`,
    ], "write");
  } else if (!cols.some((c) => c.name === "club_id")) {
    try { await db.execute(`ALTER TABLE attendance ADD COLUMN club_id TEXT NOT NULL DEFAULT '9eM6en7UzJ'`); } catch { /* already there */ }
  }
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_club_ts ON attendance(club_id, ts)`);
  return db;
}

let _conn: Promise<Client> | null = null;
const db = () => (_conn ??= connect());

export type Reading = { ts: number; current: number; max: number | null };
export type Baseline = { weekday: number; hour: number; avg: number; samples: number };
export type Snapshot = { id: string; current: number; max: number | null; ts: number };
export type SnapshotWithHistory = Snapshot & { history: { ts: number; current: number }[] };
export type ClubData = Awaited<ReturnType<typeof getClubData>>;

// Latest reading per club (48h window) + last 5h history for sparklines.
// ~37 of 116 ON AIR clubs ever expose a live counter; the rest always 204.
export async function getActiveClubs(historyHours = 5): Promise<SnapshotWithHistory[]> {
  const snapSince = Date.now() - 48 * 3_600_000;
  const histSince = Date.now() - historyHours * 3_600_000;
  const client = await db();
  const [snapR, histR] = await client.batch([
    {
      sql: `SELECT a.club_id, a.current, a.max, a.ts
              FROM attendance a
              JOIN (SELECT club_id, MAX(ts) ts FROM attendance WHERE ts > ? GROUP BY club_id) m
                ON a.club_id = m.club_id AND a.ts = m.ts
             ORDER BY a.current DESC`,
      args: [snapSince],
    },
    {
      sql: `SELECT club_id, current, ts FROM attendance WHERE ts > ? ORDER BY club_id, ts`,
      args: [histSince],
    },
  ], "read");

  const histMap = new Map<string, { ts: number; current: number }[]>();
  for (const row of histR.rows) {
    const id = String(row.club_id);
    if (!histMap.has(id)) histMap.set(id, []);
    histMap.get(id)!.push({ ts: Number(row.ts), current: Number(row.current) });
  }

  return snapR.rows.map((row) => ({
    id: String(row.club_id),
    current: Number(row.current),
    max: row.max == null ? null : Number(row.max),
    ts: Number(row.ts),
    history: histMap.get(String(row.club_id)) ?? [],
  }));
}

// Batch insert one reading per club in a single round-trip.
export async function insertReadings(ts: number, rows: { clubId: string; current: number; max: number | null }[]) {
  if (!rows.length) return;
  await (await db()).batch(
    rows.map((r) => ({
      sql: "INSERT OR IGNORE INTO attendance (ts, club_id, current, max) VALUES (?, ?, ?, ?)",
      args: [ts, r.clubId, r.current, r.max],
    })),
    "write",
  );
}

// Everything one club's dashboard needs, in a single batched read.
export async function getClubData(
  clubId: string,
  startTimestamp: number = Date.now() - 48 * 3_600_000,
  endTimestamp: number = Date.now(),
  utcOffset = "+00:00",
) {
  const [latest, recent, baseline, total] = await (await db()).batch([
    { sql: "SELECT ts, current, max FROM attendance WHERE club_id = ? ORDER BY ts DESC LIMIT 1", args: [clubId] },
    {
      sql: "SELECT ts, current, max FROM attendance WHERE club_id = ? AND ts BETWEEN ? AND ? ORDER BY ts",
      args: [clubId, startTimestamp, endTimestamp],
    },
    {
      sql: `SELECT
              CAST(strftime('%w', ts/1000, 'unixepoch', ?) AS INTEGER) AS weekday,
              CAST(strftime('%H', ts/1000, 'unixepoch', ?) AS INTEGER) AS hour,
              ROUND(AVG(current)) AS avg,
              COUNT(*) AS samples
            FROM attendance WHERE club_id = ?
            GROUP BY weekday, hour`,
      args: [utcOffset, utcOffset, clubId],
    },
    { sql: "SELECT COUNT(*) AS n FROM attendance WHERE club_id = ?", args: [clubId] },
  ], "read");

  // libsql Rows are array-like objects with methods; RSC can only pass plain
  // objects to client components, so map every row into a fresh literal.
  const reading = (r: Record<string, unknown>): Reading => ({
    ts: Number(r.ts), current: Number(r.current), max: r.max == null ? null : Number(r.max),
  });
  return {
    latest: latest.rows[0] ? reading(latest.rows[0]) : null,
    recent: recent.rows.map(reading),
    baseline: baseline.rows.map((r) => ({
      weekday: Number(r.weekday), hour: Number(r.hour), avg: Number(r.avg), samples: Number(r.samples),
    })),
    total: Number(total.rows[0]?.n ?? 0),
  };
}
