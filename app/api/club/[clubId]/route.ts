import { getClubData } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lightweight JSON feed the dashboard polls for live updates / timeframe changes.
// Same data the server component renders on first paint — no secrets cross here.
export async function GET(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const h = Number(new URL(req.url).searchParams.get("h"));
  const hours = Number.isFinite(h) && h > 0 ? Math.min(h, 24 * 90) : 48;
  return Response.json(await getClubData(clubId, hours));
}
