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
  getGameweekPlayerPoints,
  getGameweekStatLines,
  getLatestStartedGameweek,
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
    opponents[fixture.homeClubId] = { opp: fixture.awayShort, home: true };
    opponents[fixture.awayClubId] = { opp: fixture.homeShort, home: false };
  }

  // Form from the most recent gameweek that has actually been played — the
  // upcoming one has no stats yet, so it can't explain anything.
  const lastPlayed = await getLatestStartedGameweek(season.id);
  const [statLineMap, ruleRows, pointsMap] = lastPlayed
    ? await Promise.all([
        getGameweekStatLines(lastPlayed.id),
        db
          .select({
            eventKey: scoringRules.eventKey,
            position: scoringRules.position,
            points: scoringRules.points,
          })
          .from(scoringRules)
          .where(eq(scoringRules.seasonId, season.id)),
        getGameweekPlayerPoints(lastPlayed.id),
      ])
    : [null, null, null];

  const locked = !nextGameweek;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl">{tNav("transfers")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{team.name}</p>
        </div>
        {nextGameweek && (
          <p className="rounded-lg bg-card px-3 py-1.5 text-xs text-muted-foreground">
            {tTeam("gameweek", { number: nextGameweek.number })}
            {" · "}
            <span className="capitalize">
              {tTeam("deadline", {
                date: formatDeadline(nextGameweek.deadline, locale),
              })}
            </span>
          </p>
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
          statLines={statLineMap ? Object.fromEntries(statLineMap) : undefined}
          rules={ruleRows ?? undefined}
          pointsByPlayer={pointsMap ? Object.fromEntries(pointsMap) : undefined}
          locked={locked}
          opponents={opponents}
        />
      </div>
    </main>
  );
}
