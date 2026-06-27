import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getClub, DEFAULT_CLUB } from "@/lib/clubs";

export default async function Home() {
  const last = (await cookies()).get("club")?.value;
  redirect(`/${last && getClub(last) ? last : DEFAULT_CLUB}`);
}
