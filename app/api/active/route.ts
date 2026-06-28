import { getActiveClubs } from "@/lib/db";

export const dynamic = "force-dynamic";

// Latest snapshot for every club with data — feeds the dense "all clubs" grid.
export async function GET() {
  return Response.json(await getActiveClubs());
}
