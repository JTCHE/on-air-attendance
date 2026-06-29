import { getClubData } from "@/lib/db";
import { gymUtcOffset } from "@/lib/clubs";

export const dynamic = "force-dynamic";

// Lightweight JSON feed the dashboard polls for live updates / timeframe changes.
// Same data the server component renders on first paint — no secrets cross here.
export async function GET(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const searchParams = new URL(req.url).searchParams;
  const timeZone = searchParams.get("timeZone") ?? undefined;
  const utcOffset = gymUtcOffset(timeZone);

  const start = Number(searchParams.get("startTimestamp"));
  const end = Number(searchParams.get("endTimestamp"));
  const maxSpan = 90 * 24 * 3_600_000;
  const now = Date.now();

  const startTimestamp = Number.isFinite(start) && start > 0 ? start : now - 48 * 3_600_000;
  const endTimestamp =
    Number.isFinite(end) && end > startTimestamp
      ? Math.min(end, startTimestamp + maxSpan)
      : now;

  return Response.json(await getClubData(clubId, startTimestamp, endTimestamp, utcOffset));
}
