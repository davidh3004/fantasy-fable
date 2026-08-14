import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { gameweeks } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  GameweeksManager,
  type AdminGameweek,
} from "@/components/admin/gameweeks-manager";
import {
  getActiveSeasonContext,
  getClubsByCompetition,
  getFixturesForGameweek,
} from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("gameweeks") };
}

export default async function AdminGameweeksPage() {
  const { season } = await getActiveSeasonContext();
  const locale = await getLocale();

  const [gameweekRows, clubList] = await Promise.all([
    db
      .select()
      .from(gameweeks)
      .where(eq(gameweeks.seasonId, season.id))
      .orderBy(asc(gameweeks.number)),
    getClubsByCompetition(season.competitionId),
  ]);

  const withFixtures: AdminGameweek[] = await Promise.all(
    gameweekRows.map(async (gw) => {
      const fixtureRows = await getFixturesForGameweek(gw.id);
      return {
        id: gw.id,
        number: gw.number,
        deadline: gw.deadline,
        status: gw.status,
        finalizedAt: gw.finalizedAt,
        fixtures: fixtureRows.map((f) => ({
          id: f.id,
          gameweekId: gw.id,
          homeClubId: f.homeClubId,
          awayClubId: f.awayClubId,
          homeShort: f.homeShort,
          awayShort: f.awayShort,
          kickoff: f.kickoff,
          status: f.status,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
        })),
      };
    })
  );

  return (
    <GameweeksManager
      gameweeks={withFixtures}
      clubs={clubList.map((c) => ({ id: c.id, name: c.name }))}
      locale={locale}
    />
  );
}
