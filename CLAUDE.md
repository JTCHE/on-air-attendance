# Gym Occupancy Dashboard

Personal dashboard logging live occupancy of ON AIR gyms (ClubConnect platform) over
time, surfacing "busier/quieter than usual". Personal/educational, single user, the
user's own authenticated session. 116 ON AIR clubs, all pollable; user picks any.

## API (ClubConnect, host `mobile.clubconnect.fr`)

Auth: `Authorization: Bearer <JWT>` only. JWT has no `exp`, long-lived (issued
2026-04-28, still valid). Do NOT send `x-signature`/`x-timestamp` (a stale timestamp
→ 401 `authTimestampInvalid`; omitting them passes via JWT). One token reads ANY club.

Required headers: `app-version: 10.14.0` (10.13.x → 426 forceAppUpdate), `bundleid`,
`platform: ios-react`. See `lib/poll.ts`.

| Endpoint | Returns |
|---|---|
| `GET /api/mobile/attendance/{clubId}` | `{current, max, freeSlot?}`. **204 = no live counter right now** (flips to 200 by time of day). `max` null for many clubs; when set it's capacity. |
| `GET /api/mobile/club` | All 116 clubs (id, name, address, ...). Source for `lib/clubs.json`. |
| `POST /api/mobile/session` | Login `{email,password}` → token. Signed; not replayable headlessly. Token is captured manually, not refreshed in code. |

No historical/time-series endpoint exists. History is self-collected by polling.

## Architecture

- `lib/clubs.json` — `{id,name}[]` directory, brand prefix stripped. Regen: `bun scripts/gen-clubs.ts <club_list.har>`.
- `lib/poll.ts` — `pollAll(token)`: shuffles all clubs, fetches attendance at concurrency 8 with jitter, batch-inserts one row per club that returned 200. Endpoint is CDN-cached ~267s, so 5-min cadence is the floor.
- `lib/db.ts` — libsql. `attendance(ts, club_id, current, max)`, unique `(club_id, ts)`. Node client for local `file:`, web client for Turso (Lambda can't load native bindings). `getClubData(clubId)` returns latest/recent(48h)/baseline/total in one batched read.
- `app/[clubId]/page.tsx` — Server Component, reads DB directly (no API routes). `generateMetadata` → title `{name} | Occupation`. `app/page.tsx` redirects to last club (cookie) or default.
- `components/dashboard.tsx` — client; cards (now / vs usual / capacity-if-`max` / coverage), SVG trend chart, weekly heatmap. `router.refresh()` every 60s for live data. Sets `club` cookie.
- `netlify/functions/poll.ts` — scheduled `*/5 * * * *`, calls `pollAll`.

## Run

```
bun run dev          # dashboard (needs TURSO_URL + CLUBCONNECT_TOKEN, or file:gym.db local)
bun run collect      # local poller → file:gym.db
```

## Deploy (Netlify)

Prod: https://courageous-tulumba-a66f3c.netlify.app · Turso DB `on-air-gym` (eu-west-1).
Env vars: `TURSO_URL`, `TURSO_AUTH_TOKEN`, `CLUBCONNECT_TOKEN`.

**Token refresh:** when polling 401s, re-capture the Bearer token from the ClubConnect app
(Proxyman) and `netlify env:set CLUBCONNECT_TOKEN <token>`.

## Open

- `max`/capacity only present for some clubs; "% full" not derivable elsewhere.
- DEFAULT_CLUB `9eM6en7UzJ` = Montpellier Celleneuve (user's club).
- Baseline is AVG by (weekday, hour); swap to percentile once weeks of data exist.
