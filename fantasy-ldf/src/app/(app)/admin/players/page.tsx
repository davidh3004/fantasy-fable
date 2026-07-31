import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayersManager } from "@/components/admin/players-manager";
import {
  getActiveSeasonContext,
  getAdminPlayers,
  getClubsByCompetition,
} from "@/lib/game/queries";
import type { Position } from "@/lib/game/squad";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("players") };
}

const PAGE_SIZE = 25;
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; club?: string; pos?: string; page?: string }>;
}) {
  const { q, club, pos, page } = await searchParams;
  const { season } = await getActiveSeasonContext();

  const pageNum = Math.max(1, Number(page) || 1);
  const position = POSITIONS.includes(pos ?? "") ? (pos as Position) : undefined;
  const search = q?.trim() || undefined;

  const [{ rows, total }, clubList] = await Promise.all([
    getAdminPlayers({
      competitionId: season.competitionId,
      clubId: club || undefined,
      position,
      search,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    }),
    getClubsByCompetition(season.competitionId),
  ]);

  return (
    <PlayersManager
      players={rows}
      total={total}
      page={pageNum}
      pageSize={PAGE_SIZE}
      clubs={clubList.map((c) => ({ id: c.id, name: c.name }))}
      filters={{ q: q ?? "", club: club ?? "all", pos: pos ?? "all" }}
    />
  );
}
