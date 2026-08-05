import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { asc, eq, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import {
  clubs,
  fixtures,
  playerMatchStats,
  players,
  scoringRules,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { MatchConsole } from "@/components/admin/match-console";
import type { LiveStatLine } from "@/app/(app)/admin/actions";
import { getActiveSeasonContext } from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("results") };
}

export default async function AdminResultEntryPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const t = await getTranslations("admin.result");

  const { season, settings } = await getActiveSeasonContext();

  const homeClub = alias(clubs, "home_club");
  const awayClub = alias(clubs, "away_club");
  const [fixture] = await db
    .select({
      id: fixtures.id,
      homeClubId: fixtures.homeClubId,
      awayClubId: fixtures.awayClubId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      status: fixtures.status,
      kickoff: fixtures.kickoff,
      homeName: homeClub.name,
      awayName: awayClub.name,
    })
    .from(fixtures)
    .innerJoin(homeClub, eq(fixtures.homeClubId, homeClub.id))
    .innerJoin(awayClub, eq(fixtures.awayClubId, awayClub.id))
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  if (!fixture) notFound();

  const [playerRows, statRows, ruleRows] = await Promise.all([
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        clubId: players.clubId,
      })
      .from(players)
      .where(
        or(
          eq(players.clubId, fixture.homeClubId),
          eq(players.clubId, fixture.awayClubId)
        )
      )
      .orderBy(asc(players.position), asc(players.lastName)),
    db
      .select()
      .from(playerMatchStats)
      .where(eq(playerMatchStats.fixtureId, fixtureId)),
    db
      .select({
        eventKey: scoringRules.eventKey,
        position: scoringRules.position,
        points: scoringRules.points,
      })
      .from(scoringRules)
      .where(eq(scoringRules.seasonId, season.id)),
  ]);

  const existingStats: LiveStatLine[] = statRows.map((s) => ({
    playerId: s.playerId,
    minutes: s.minutes,
    goals: s.goals,
    assists: s.assists,
    saves: s.saves,
    penaltiesSaved: s.penaltiesSaved,
    penaltiesMissed: s.penaltiesMissed,
    yellowCards: s.yellowCards,
    redCards: s.redCards,
    ownGoals: s.ownGoals,
    started: s.started,
    onMinute: s.onMinute,
    offMinute: s.offMinute,
  }));

  const bonusOf = (points: number) =>
    statRows.find((s) => s.bonusPoints === points)?.playerId ?? "";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/results"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <MatchConsole
        fixtureId={fixture.id}
        kickoff={fixture.kickoff.toISOString()}
        isFinished={fixture.status === "finished"}
        homeName={fixture.homeName}
        awayName={fixture.awayName}
        homeClubId={fixture.homeClubId}
        awayClubId={fixture.awayClubId}
        initialHomeScore={fixture.homeScore}
        initialAwayScore={fixture.awayScore}
        players={playerRows.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          position: p.position,
          clubId: p.clubId,
        }))}
        existingStats={existingStats}
        existingBonus={{
          first: bonusOf(3),
          second: bonusOf(2),
          third: bonusOf(1),
        }}
        rules={ruleRows}
        startingSize={settings.startingSize}
      />
    </div>
  );
}
