import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, EyeOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { ReadonlyPitch } from "@/components/team/readonly-pitch";
import type { OpponentInfo } from "@/components/team/lineup-editor";
import { resolveLineup, type EnginePick } from "@/lib/game/engine";
import {
  getActiveSeasonContext,
  getFantasyTeamPublic,
  getFixturesForGameweek,
  getGameweekPlayerPoints,
  getGameweekPlayerStats,
  getManagerLineup,
  toSquadSettings,
  type ManagerPick,
} from "@/lib/game/queries";
import { effectiveFixtureStatus } from "@/lib/game/status";
import { getTeamGameweekPoints } from "@/lib/game/gameweek-points";
import { ensureLineupsForGameweek } from "@/lib/game/ensure-lineups";
import {
  getSeasonGameweeks,
  getSeasonStatLinesByGameweek,
} from "@/lib/game/queries";
import { GameweekNav } from "@/components/team/gameweek-nav";
import {
  buildViewableGameweeks,
  pickDefaultGameweek,
} from "@/lib/game/team-gameweeks";
import { db } from "@/db";
import { scoringRules } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manager");
  return { title: t("title") };
}

/** Only allow in-app league paths as the back target. */
function safeBackHref(from: string | undefined): string {
  if (from && /^\/leagues(\/[\w-]+)?$/.test(from)) return from;
  return "/leagues";
}

export default async function ManagerTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string; gw?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { teamId } = await params;
  const { from, gw } = await searchParams;
  const backHref = safeBackHref(from);

  const { season, settings } = await getActiveSeasonContext();
  const t = await getTranslations("manager");
  const tTeam = await getTranslations("team");

  const team = await getFantasyTeamPublic(teamId);
  if (!team || team.seasonId !== season.id) notFound();

  // Only gameweeks that have actually started: a rival's upcoming lineup
  // stays hidden until its deadline passes, same as before.
  const now = new Date();
  const viewable = buildViewableGameweeks(
    await getSeasonGameweeks(season.id),
    null,
    now
  );
  const requested = Number(gw);
  const startedGameweek =
    viewable.find((g) => g.number === requested) ??
    pickDefaultGameweek(viewable, null, now);

  const selectedIndex = startedGameweek
    ? viewable.findIndex((g) => g.id === startedGameweek.id)
    : -1;
  const gwHref = (number: number) =>
    `/managers/${teamId}?gw=${number}&from=${encodeURIComponent(backHref)}`;

  // What this manager scored in the gameweek on show — the header only had
  // their season total, which says nothing about how they're doing right now.
  const squadSettings = toSquadSettings(settings);
  const gameweekPoints = startedGameweek
    ? await getTeamGameweekPoints(teamId, startedGameweek, squadSettings)
    : null;

  const Header = (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <div className="mt-3 mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl">{team.name}</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {team.managerName}
            {" · "}
            {tTeam("points", { points: team.totalPoints })}
          </p>
        </div>
        {gameweekPoints != null && (
          <p className="shrink-0 text-right">
            <span className="font-heading text-2xl tabular-nums">
              {gameweekPoints}
            </span>{" "}
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {tTeam("ptsLabel")}
            </span>
          </p>
        )}
      </div>
    </>
  );

  // Pre-season: nobody's picks are visible yet.
  if (!startedGameweek) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {Header}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <EyeOff className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("hidden")}</p>
        </div>
      </main>
    );
  }

  const isFinalized = startedGameweek.status === "finished";

  // Same freeze as the team page — only gameweeks whose deadline has passed
  // reach this point, and a rival's page is as likely as your own to be the
  // first read after one does.
  await ensureLineupsForGameweek(
    startedGameweek.id,
    season.id,
    settings.startingSize
  );

  const [picks, gameweekFixtures] = await Promise.all([
    getManagerLineup(teamId, startedGameweek.id),
    getFixturesForGameweek(startedGameweek.id),
  ]);

  // Rendered above the pitch *and* above the empty state: a gameweek this
  // manager has no lineup for is still a gameweek you must be able to step
  // off, so the arrows stay put.
  const Nav = (
    <div className="mb-4">
      <GameweekNav
        number={startedGameweek.number}
        statusLabel={isFinalized ? tTeam("finished") : tTeam("live")}
        subLabel={isFinalized ? tTeam("finishedSub") : tTeam("liveSub")}
        isLive={!isFinalized}
        prevHref={
          selectedIndex > 0 ? gwHref(viewable[selectedIndex - 1].number) : null
        }
        nextHref={
          selectedIndex >= 0 && selectedIndex < viewable.length - 1
            ? gwHref(viewable[selectedIndex + 1].number)
            : null
        }
      />
    </div>
  );

  if (picks.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {Header}
        {Nav}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <EyeOff className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("noLineup")}</p>
        </div>
      </main>
    );
  }

  const opponents: Record<string, OpponentInfo> = {};
  const liveClubs = new Set<string>();
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
    const status = effectiveFixtureStatus(fixture);
    if (status === "live" || status === "finished") {
      liveClubs.add(fixture.homeClubId);
      liveClubs.add(fixture.awayClubId);
    }
  }

  const captainId = picks.find((p) => p.isCaptain)?.id ?? "";
  const viceId = picks.find((p) => p.isVice)?.id ?? "";

  let starterIds: string[];
  let benchIds: string[];
  const pointsByPlayer: Record<string, number> = {};

  if (isFinalized) {
    // Run the engine so the displayed XI reflects auto-subs: a starter who
    // didn't play is replaced on the pitch by the bench player who counted.
    const stats = await getGameweekPlayerStats(startedGameweek.id);
    const enginePicks: EnginePick[] = picks.map((p) => ({
      playerId: p.id,
      slot: p.slot,
      isCaptain: p.isCaptain,
      isVice: p.isVice,
      position: p.position,
      points: stats.get(p.id)?.points ?? 0,
      minutes: stats.get(p.id)?.minutes ?? 0,
    }));
    const resolved = resolveLineup(enginePicks, squadSettings);

    const startersAfter = picks.filter((p) =>
      resolved.finalStarterIds.has(p.id)
    );
    const benchAfter = picks
      .filter((p) => !resolved.finalStarterIds.has(p.id))
      .sort((a, b) => {
        if (a.position === "GK" && b.position !== "GK") return -1;
        if (b.position === "GK" && a.position !== "GK") return 1;
        return a.slot - b.slot;
      });

    starterIds = startersAfter.map((p) => p.id);
    benchIds = benchAfter.map((p) => p.id);
    for (const p of picks) {
      pointsByPlayer[p.id] = resolved.pickPoints.get(p.id) ?? 0;
    }
  } else {
    // Live / locked but not finalized: show the chosen XI as saved, with
    // live raw points for clubs that have kicked off.
    const starters = picks.filter(
      (p: ManagerPick) => p.slot <= squadSettings.startingSize
    );
    const bench = picks.filter(
      (p: ManagerPick) => p.slot > squadSettings.startingSize
    );
    starterIds = starters.map((p) => p.id);
    benchIds = bench.map((p) => p.id);

    const livePoints = await getGameweekPlayerPoints(startedGameweek.id);
    for (const pick of picks) {
      if (liveClubs.has(pick.clubId)) {
        pointsByPlayer[pick.id] = livePoints.get(pick.id) ?? 0;
      }
    }
  }

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
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {Header}
      {Nav}

      <ReadonlyPitch
        players={picks}
        starterIds={starterIds}
        benchIds={benchIds}
        captainId={captainId}
        viceId={viceId}
        opponents={opponents}
        pointsByPlayer={pointsByPlayer}
        statsByGameweek={statsByGameweek}
        rules={ruleRows}
        viewingGameweekId={startedGameweek.id}
      />
    </main>
  );
}
