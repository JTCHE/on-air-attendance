import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClub, gymUtcOffset, gymDayRange, type Club } from "@/lib/clubs";
import { getClubData, getActiveClubs } from "@/lib/db";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ clubId: string }> }): Promise<Metadata> {
  const club = getClub((await params).clubId);
  return { title: club ? `${club.name} | Occupation` : "Occupation" };
}


export default async function ClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = getClub(clubId);
  if (!club) notFound();

  const utcOffset = gymUtcOffset(club.timeZone);
  const dateRange = gymDayRange(Date.now(), club.timeZone ?? "Europe/Paris", club.openingHours);
  const [data, active] = await Promise.all([
    getClubData(clubId, dateRange.startTimestamp, dateRange.endTimestamp, utcOffset),
    getActiveClubs(),
  ]);
  return <Dashboard club={club} initial={data} initialDateRange={dateRange} active={active} />;
}
