import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClub } from "@/lib/clubs";
import { getClubData } from "@/lib/db";
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

  const data = await getClubData(clubId);
  return <Dashboard club={club} initial={data} />;
}
