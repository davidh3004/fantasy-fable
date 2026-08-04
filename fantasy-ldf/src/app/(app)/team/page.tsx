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
  getLineupPicks,
  getNextGameweek,
  getSquadPlayers,
  getTeamLineupGameweeks,
  getUserFantasyTeam,
  toSquadSettings,
  type TeamGameweek,
} from "@/lib/game/queries";
import { getTeamGameweekPoints } from "@/lib/game/gameweek-points";

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

  // Viewable gameweeks: those with a saved lineup, plus the upcoming editable
  // one (which may not have a lineup row yet for brand-new teams).
  const lineupGameweeks = await getTeamLineupGameweeks(team.id);
  const viewable: TeamGameweek[] = [...lineupGameweeks];
  if (nextGameweek && !viewable.some((g) => g.id === nextGameweek.id)) {
    viewable.push({
      id: nextGameweek.id,
      number: nextGameweek.number,
      status: nextGameweek.status,
      deadline: nextGameweek.deadline,
    });
    viewable.sort((a, b) => a.number - b.number);
  }

  const defaultNumber = nextGameweek?.number ?? viewable.at(-1)?.number;
  const requested = Number(gw);
  const selectedNumber = viewable.some((g) => g.number === requested)
    ? requested
    : defaultNumber;
  const selected = viewable.find((g) => g.number === selectedNumber) ?? null;

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

  const now = new Date();
  const isFinalized = selected.status === "finished";
  const isEditable =
    nextGameweek != null &&
    selected.id === nextGameweek.id &&
    selected.deadline > now;
  const isLive = !isFinalized && selected.deadline <= now;

  const [picks, gameweekFixtures] = await Promise.all([
    getLineupPicks(team.id, selected.id),
    getFixturesForGameweek(selected.id),
  ]);

  const opponents: Record<string, OpponentInfo> = {};
  const liveClubs = new Set<string>();
  // Clubs whose match is in play *right now* — these get the gold treatment.
  const playingClubs = new Set<string>();
  for (const fixture of gameweekFixtures) {
    opponents[fixture.homeClubId] = { opp: fixture.awayShort, home: true };
    opponents[fixture.awayClubId] = { opp: fixture.homeShort, home: false };
    if (fixture.status === "live" || fixture.status === "finished") {
      liveClubs.add(fixture.homeClubId);
      liveClubs.add(fixture.awayClubId);
    }
    if (fixture.status === "live") {
      playingClubs.add(fixture.homeClubId);
      playingClubs.add(fixture.awayClubId);
    }
  }
  const livePlayerIds = squad
    .filter((player) => playingClubs.has(player.clubId))
    .map((player) => player.id);

  // Points to show under each player.
  const pointsByPlayer: Record<string, number> = {};
  if (isFinalized) {
    // Finalized snapshot (captain ×2 baked in).
    for (const pick of picks) {
      if (pick.points != null) pointsByPlayer[pick.playerId] = pick.points;
    }
  } else if (isLive) {
    // Live: raw match points for players whose club has kicked off.
    const livePoints = await getGameweekPlayerPoints(selected.id);
    for (const player of squad) {
      if (liveClubs.has(player.clubId)) {
        pointsByPlayer[player.id] = livePoints.get(player.id) ?? 0;
      }
    }
  }

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
        prevNumber={
          selectedIndex > 0 ? viewable[selectedIndex - 1].number : null
        }
        nextNumber={
          selectedIndex < viewable.length - 1
            ? viewable[selectedIndex + 1].number
            : null
        }
      />

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
        />
      </div>
    </main>
  );
}
