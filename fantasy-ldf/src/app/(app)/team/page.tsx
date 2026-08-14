import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import {
  LineupEditor,
  type OpponentInfo,
} from "@/components/team/lineup-editor";
import { GameweekNav } from "@/components/team/gameweek-nav";
import { formatDeadline } from "@/lib/game/format";
import { buildInitialLineup } from "@/lib/game/squad";
import type { LineupState } from "@/lib/game/lineup";
import {
  getActiveSeasonContext,
  getFixturesForGameweek,
  getGameweekPlayerPoints,
  getSeasonStatLinesByGameweek,
  getLineupPicks,
  getNextGameweek,
  getSeasonGameweeks,
  getSquadPlayers,
  getUserFantasyTeam,
  toSquadSettings,
} from "@/lib/game/queries";
import { getTeamGameweekPoints } from "@/lib/game/gameweek-points";
import { ensureLineupsForGameweek } from "@/lib/game/ensure-lineups";
import { resolveGameweekLineupPoints } from "@/lib/game/lineup-points";
import { effectiveFixtureStatus } from "@/lib/game/status";
import { db } from "@/db";
import { scoringRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  buildViewableGameweeks,
  pickDefaultGameweek,
} from "@/lib/game/team-gameweeks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("team") };
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { gw } = await searchParams;
  const { season, settings } = await getActiveSeasonContext();

  const [team, nextGameweek, t, locale] = await Promise.all([
    getUserFantasyTeam(user.id, season.id),
    getNextGameweek(season.id),
    getTranslations("team"),
    getLocale(),
  ]);
  if (!team) redirect("/onboarding");

  const squad = await getSquadPlayers(team.id);
  const squadSettings = toSquadSettings(settings);

  const now = new Date();

  // The range spans the season's started gameweeks, not just the ones this
  // team has a lineup row for — otherwise everything before the team was
  // created is unreachable and the nav arrows dead-end.
  const seasonGameweeks = await getSeasonGameweeks(season.id);
  const viewable = buildViewableGameweeks(seasonGameweeks, nextGameweek, now);

  const requested = Number(gw);
  const selected =
    viewable.find((g) => g.number === requested) ??
    pickDefaultGameweek(viewable, nextGameweek, now);

  // No gameweeks at all: read-only default lineup.
  if (!selected) {
    const initial = buildInitialLineup(squad);
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="truncate font-heading text-2xl">{team.name}</h1>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
          <CalendarOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("noGameweek")}</span>
        </div>
        <div className="mt-5">
          <LineupEditor
            players={squad}
            settings={squadSettings}
            initialLineup={{
              starterIds: initial.starters.map((p) => p.id),
              benchIds: initial.bench.map((p) => p.id),
            }}
            initialCaptainId={initial.captainId}
            initialViceId={initial.viceId}
            locked
            opponents={{}}
            pointsByPlayer={{}}
          />
        </div>
      </main>
    );
  }

  const isFinalized = selected.status === "finished";
  const isEditable =
    nextGameweek != null &&
    selected.id === nextGameweek.id &&
    selected.deadline > now;
  const isLive = !isFinalized && selected.deadline <= now;

  // Once the deadline has passed the squad that was standing is the one that
  // plays, but nothing writes that row until an admin finalizes — which can be
  // days later, or never for a gameweek nobody finalizes. So freeze it on the
  // first read after the deadline: managers who were already playing get their
  // lineup, instead of being told they had no team. Idempotent, and a no-op
  // once the rows exist, so later reads pay one cheap lookup.
  if (!isEditable && selected.deadline <= now) {
    await ensureLineupsForGameweek(
      selected.id,
      season.id,
      settings.startingSize
    );
  }

  const [picks, gameweekFixtures] = await Promise.all([
    getLineupPicks(team.id, selected.id),
    getFixturesForGameweek(selected.id),
  ]);

  const opponents: Record<string, OpponentInfo> = {};
  const liveClubs = new Set<string>();
  // Clubs whose match is in play *right now* — these get the gold treatment.
  const playingClubs = new Set<string>();
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
    // Derived, so a match that has kicked off counts as live even if nobody
    // moved its status in the admin panel.
    const status = effectiveFixtureStatus(fixture, now);
    if (status === "live" || status === "finished") {
      liveClubs.add(fixture.homeClubId);
      liveClubs.add(fixture.awayClubId);
    }
    if (status === "live") {
      playingClubs.add(fixture.homeClubId);
      playingClubs.add(fixture.awayClubId);
    }
  }
  const livePlayerIds = squad
    .filter((player) => playingClubs.has(player.clubId))
    .map((player) => player.id);

  // Stat lines + rules power the modal's stepper. Fetched for every gameweek,
  // including upcoming ones: the stepper walks the player's whole season, so
  // gating on "has the viewed gameweek started" hid the history that already
  // exists whenever a deadline is pending. Bounded by squad × gameweeks.
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

  // Points to show under each player.
  let pointsByPlayer: Record<string, number> = {};
  if (isFinalized) {
    // The finalized snapshot when there is one (captain ×2 baked in), the match
    // stats when there isn't. Either way every player in the lineup gets a
    // number: a finished gameweek must never show fixtures again, and a player
    // who didn't play scores 0.
    ({ pointsByPlayer } = await resolveGameweekLineupPoints(
      selected.id,
      picks.map((pick) => ({ ...pick, bankedPoints: pick.points })),
      squadSettings
    ));
  } else if (isLive) {
    // Live: raw match points for players whose club has kicked off.
    const livePoints = await getGameweekPlayerPoints(selected.id);
    for (const player of squad) {
      if (liveClubs.has(player.clubId)) {
        pointsByPlayer[player.id] = livePoints.get(player.id) ?? 0;
      }
    }
  }

  // A started gameweek with no picks means the team didn't exist yet. Say so
  // rather than painting today's squad onto it as if it had been the lineup —
  // the auto-built fallback below is only for a brand-new team whose upcoming
  // lineup row hasn't been written yet.
  const hadNoTeam = picks.length === 0 && !isEditable;

  // Build the lineup state for the selected gameweek.
  let lineup: LineupState;
  let captainId: string;
  let viceId: string;
  if (picks.length > 0) {
    const starters = picks.filter((p) => p.slot <= squadSettings.startingSize);
    const bench = picks.filter((p) => p.slot > squadSettings.startingSize);
    lineup = {
      starterIds: starters.map((p) => p.playerId),
      benchIds: bench.map((p) => p.playerId),
    };
    captainId = picks.find((p) => p.isCaptain)?.playerId ?? "";
    viceId = picks.find((p) => p.isVice)?.playerId ?? "";
  } else {
    const initial = buildInitialLineup(squad);
    lineup = {
      starterIds: initial.starters.map((p) => p.id),
      benchIds: initial.bench.map((p) => p.id),
    };
    captainId = initial.captainId;
    viceId = initial.viceId;
  }

  const selectedIndex = viewable.findIndex((g) => g.id === selected.id);
  const statusLabel = isLive
    ? t("live")
    : isFinalized
      ? t("finished")
      : t("upcoming");
  const subLabel = isEditable
    ? t("deadline", { date: formatDeadline(selected.deadline, locale) })
    : isLive
      ? t("liveSub")
      : isFinalized
        ? t("finishedSub")
        : formatDeadline(selected.deadline, locale);

  const gameweekPoints = await getTeamGameweekPoints(
    team.id,
    selected,
    squadSettings
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="min-w-0 truncate font-heading text-2xl">{team.name}</h1>
        {gameweekPoints != null && (
          <p className="shrink-0 text-right">
            <span className="font-heading text-2xl tabular-nums">
              {gameweekPoints}
            </span>{" "}
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("ptsLabel")}
            </span>
          </p>
        )}
      </div>

      <GameweekNav
        number={selected.number}
        statusLabel={statusLabel}
        subLabel={subLabel}
        isLive={isLive}
        prevHref={
          selectedIndex > 0
            ? `/team?gw=${viewable[selectedIndex - 1].number}`
            : null
        }
        nextHref={
          selectedIndex < viewable.length - 1
            ? `/team?gw=${viewable[selectedIndex + 1].number}`
            : null
        }
      />

      {hadNoTeam ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
          <CalendarOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("noLineup")}</span>
        </div>
      ) : (
        <div className="mt-5">
          <LineupEditor
            key={selected.id}
            players={squad}
            settings={squadSettings}
            initialLineup={lineup}
            initialCaptainId={captainId}
            initialViceId={viceId}
            locked={!isEditable}
            opponents={opponents}
            pointsByPlayer={pointsByPlayer}
            livePlayerIds={livePlayerIds}
            statsByGameweek={statsByGameweek ?? undefined}
            rules={ruleRows ?? undefined}
            viewingGameweekId={selected.id}
          />
        </div>
      )}
    </main>
  );
}
