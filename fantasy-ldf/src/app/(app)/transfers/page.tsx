import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { TransfersEditor } from "@/components/transfers/transfers-editor";
import type { OpponentInfo } from "@/components/team/lineup-editor";
import { formatDeadline } from "@/lib/game/format";
import { db } from "@/db";
import { scoringRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getActiveSeasonContext,
  getFixturesForGameweek,
  getSeasonStatLinesByGameweek,
  getMarketPlayers,
  getNextGameweek,
  getSquadPlayers,
  getUserFantasyTeam,
  hasSeasonStarted,
  toSquadSettings,
} from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("transfers") };
}

export default async function TransfersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { season, settings } = await getActiveSeasonContext();

  const [team, nextGameweek, seasonStarted, t, tNav, tTeam, locale] =
    await Promise.all([
      getUserFantasyTeam(user.id, season.id),
      getNextGameweek(season.id),
      hasSeasonStarted(season.id),
      getTranslations("transfers"),
      getTranslations("nav"),
      getTranslations("team"),
      getLocale(),
    ]);
  if (!team) redirect("/onboarding");

  const [squad, allPlayers, gameweekFixtures] = await Promise.all([
    getSquadPlayers(team.id),
    getMarketPlayers(season.competitionId),
    nextGameweek ? getFixturesForGameweek(nextGameweek.id) : [],
  ]);

  const opponents: Record<string, OpponentInfo> = {};
  for (const fixture of gameweekFixtures) {
    opponents[fixture.homeClubId] = {
      opp: fixture.awayShort,
      home: true,
      name: fixture.awayName,
      color: fixture.awayColor,
      badgeUrl: fixture.awayBadgeUrl,
    };
    opponents[fixture.awayClubId] = {
      opp: fixture.homeShort,
      home: false,
      name: fixture.homeName,
      color: fixture.homeColor,
      badgeUrl: fixture.homeBadgeUrl,
    };
  }

  // Every played gameweek, so the modal can step through a player's season
  // when weighing up a transfer.
  const [statsByGameweek, ruleRows] = await Promise.all([
    getSeasonStatLinesByGameweek(season.id),
    db
      .select({
        eventKey: scoringRules.eventKey,
        position: scoringRules.position,
        points: scoringRules.points,
      })
      .from(scoringRules)
      .where(eq(scoringRules.seasonId, season.id)),
  ]);

  const locked = !nextGameweek;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Title left, deadline right, on one line — items-start keeps the pill
          level with the heading rather than with the team name below it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl">{tNav("transfers")}</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {team.name}
          </p>
        </div>
        {nextGameweek && (
          /* Two lines: gameweek on top, deadline beneath. On one line it ran
             long enough to crowd the title on a phone. */
          <div className="shrink-0 rounded-lg bg-card px-3 py-1.5 text-right">
            <p className="text-xs font-medium">
              {tTeam("gameweek", { number: nextGameweek.number })}
            </p>
            <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
              {tTeam("deadline", {
                date: formatDeadline(nextGameweek.deadline, locale),
              })}
            </p>
          </div>
        )}
      </div>

      {locked && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
          <CalendarOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("locked")}</span>
        </div>
      )}

      <div className="mt-5">
        <TransfersEditor
          squad={squad}
          allPlayers={allPlayers}
          settings={toSquadSettings(settings)}
          hitCost={settings.transferHitCost}
          freeTransfers={team.freeTransfers}
          bank={team.budget}
          preSeason={!seasonStarted}
          statsByGameweek={statsByGameweek}
          rules={ruleRows}
          locked={locked}
          opponents={opponents}
        />
      </div>
    </main>
  );
}
