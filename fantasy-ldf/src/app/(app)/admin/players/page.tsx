import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayersManager } from "@/components/admin/players-manager";
import {
  getActiveSeasonContext,
  getClubsByCompetition,
  getMarketPlayers,
} from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("players") };
}

export default async function AdminPlayersPage() {
  const { season } = await getActiveSeasonContext();
  const [playerList, clubList] = await Promise.all([
    getMarketPlayers(season.competitionId),
    getClubsByCompetition(season.competitionId),
  ]);

  return (
    <PlayersManager
      players={playerList}
      clubs={clubList.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
