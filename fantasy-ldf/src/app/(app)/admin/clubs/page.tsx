import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { clubs, players } from "@/db/schema";
import { ClubsManager } from "@/components/admin/clubs-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("clubs") };
}

export default async function AdminClubsPage() {
  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      shortName: clubs.shortName,
      primaryColor: clubs.primaryColor,
      secondaryColor: clubs.secondaryColor,
      badgeUrl: clubs.badgeUrl,
      playerCount: count(players.id),
    })
    .from(clubs)
    .leftJoin(players, eq(players.clubId, clubs.id))
    .groupBy(clubs.id)
    .orderBy(asc(clubs.name));

  return <ClubsManager clubs={rows} />;
}
