"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath, updateTag } from "next/cache";
import { and, count, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  chipPlays,
  clubs,
  fixtures,
  gameSettings,
  gameweekLineups,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  players,
  scoringRules,
  squadPicks,
  transfers,
} from "@/db/schema";
import {
  runFinalizeGameweek,
  runUnfinalizeGameweek,
} from "@/lib/game/finalize";
import { requireAdminAction } from "@/lib/admin";
import { pickedFile, uploadImage } from "@/lib/storage";
import { buildRuleLookup, computePoints } from "@/lib/game/scoring";
import { FULL_TIME_MINUTE, minutesPlayed } from "@/lib/game/match-clock";
import { getActiveSeasonContext, MARKET_PLAYERS_TAG } from "@/lib/game/queries";
import type { Position } from "@/lib/game/squad";

export type AdminActionState = { error?: string; success?: boolean };

const ok: AdminActionState = { success: true };
const fail = (error: string): AdminActionState => ({ error });

/**
 * Turns a database error into a friendly action result instead of letting it
 * escape the server action, which renders the generic "page couldn't load"
 * screen. 23503 = foreign key violation (rows elsewhere still point at this).
 */
function dbFailure(context: string, err: unknown): AdminActionState {
  const code = (err as { code?: string }).code;
  if (code === "23503") return fail("in_use");
  Sentry.captureException(err, { tags: { area: "admin-action", context } });
  console.error(`${context} failed:`, err);
  return fail("unknown");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : NaN;
}

/** "2026-06-20T19:00" entered in Dominican time (AST, UTC-4, no DST). */
function parseAstDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 16)}:00-04:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateAll() {
  for (const path of ["/admin", "/home", "/team", "/transfers", "/matches"]) {
    revalidatePath(path, "layout");
  }
  // The market list is cached for five minutes; without this an edited price,
  // photo or injury flag would sit stale behind that window. updateTag rather
  // than revalidateTag: it expires immediately instead of serving the stale
  // copy once more, so an admin sees their own edit on the next render.
  updateTag(MARKET_PLAYERS_TAG);
}

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export async function saveClub(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const id = str(formData, "id");
  const name = str(formData, "name");
  const shortName = str(formData, "shortName").toUpperCase();
  if (name.length < 2 || shortName.length < 2 || shortName.length > 4) {
    return fail("validation");
  }

  let badgeUrl: string | null = str(formData, "badgeUrl") || null;
  const badgeFile = pickedFile(formData, "badgeFile");
  if (badgeFile) {
    const upload = await uploadImage(badgeFile, "clubs");
    if (upload.error) return fail(upload.error);
    badgeUrl = upload.url;
  }

  const values = {
    name,
    shortName,
    primaryColor: str(formData, "primaryColor") || null,
    secondaryColor: str(formData, "secondaryColor") || null,
    badgeUrl,
  };

  try {
    if (id) {
      await db.update(clubs).set(values).where(eq(clubs.id, id));
    } else {
      const { season } = await getActiveSeasonContext();
      await db
        .insert(clubs)
        .values({ ...values, competitionId: season.competitionId });
    }
  } catch {
    return fail("unknown");
  }
  revalidateAll();
  return ok;
}

export async function deleteClub(id: string): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const [playerCount] = await db
    .select({ n: count() })
    .from(players)
    .where(eq(players.clubId, id));
  const [fixtureCount] = await db
    .select({ n: count() })
    .from(fixtures)
    .where(or(eq(fixtures.homeClubId, id), eq(fixtures.awayClubId, id)));
  if (playerCount.n > 0 || fixtureCount.n > 0) return fail("in_use");

  try {
    await db.delete(clubs).where(eq(clubs.id, id));
  } catch (err) {
    return dbFailure("deleteClub", err);
  }
  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function savePlayer(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const id = str(formData, "id");
  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const clubId = str(formData, "clubId");
  const position = str(formData, "position") as Position;
  const status = str(formData, "status") as
    | "available"
    | "injured"
    | "suspended"
    | "unavailable";
  const priceDecimal = num(formData, "price");

  if (
    !firstName ||
    !lastName ||
    !clubId ||
    !["GK", "DEF", "MID", "FWD"].includes(position) ||
    !["available", "injured", "suspended", "unavailable"].includes(status) ||
    !Number.isFinite(priceDecimal) ||
    priceDecimal <= 0
  ) {
    return fail("validation");
  }

  let photoUrl: string | null = str(formData, "photoUrl") || null;
  const photoFile = pickedFile(formData, "photoFile");
  if (photoFile) {
    const upload = await uploadImage(photoFile, "players");
    if (upload.error) return fail(upload.error);
    photoUrl = upload.url;
  }

  const values = {
    firstName,
    lastName,
    clubId,
    position,
    status,
    price: Math.round(priceDecimal * 10),
    photoUrl,
  };

  try {
    if (id) {
      await db.update(players).set(values).where(eq(players.id, id));
    } else {
      await db.insert(players).values(values);
    }
  } catch {
    return fail("unknown");
  }
  revalidateAll();
  return ok;
}

export async function deletePlayer(id: string): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const [inSquads] = await db
    .select({ n: count() })
    .from(squadPicks)
    .where(eq(squadPicks.playerId, id));
  const [inLineups] = await db
    .select({ n: count() })
    .from(lineupPicks)
    .where(eq(lineupPicks.playerId, id));
  const [inTransfers] = await db
    .select({ n: count() })
    .from(transfers)
    .where(
      or(eq(transfers.playerInId, id), eq(transfers.playerOutId, id))
    );
  const [inStats] = await db
    .select({ n: count() })
    .from(playerMatchStats)
    .where(eq(playerMatchStats.playerId, id));
  if (inSquads.n > 0 || inLineups.n > 0 || inTransfers.n > 0 || inStats.n > 0) {
    return fail("in_use");
  }

  try {
    await db.delete(players).where(eq(players.id, id));
  } catch (err) {
    return dbFailure("deletePlayer", err);
  }
  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Gameweeks
// ---------------------------------------------------------------------------

export async function saveGameweek(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const id = str(formData, "id");
  const number = num(formData, "number");
  const deadline = parseAstDateTime(str(formData, "deadline"));
  const status = str(formData, "status") as "upcoming" | "locked" | "finished";

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    !deadline ||
    !["upcoming", "locked", "finished"].includes(status)
  ) {
    return fail("validation");
  }

  try {
    if (id) {
      await db
        .update(gameweeks)
        .set({ number, deadline, status })
        .where(eq(gameweeks.id, id));
    } else {
      const { season } = await getActiveSeasonContext();
      await db
        .insert(gameweeks)
        .values({ seasonId: season.id, number, deadline, status });
    }
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      return fail("duplicate_number");
    }
    return fail("unknown");
  }
  revalidateAll();
  return ok;
}

/** Sets the deadline to (first kickoff − configured offset). */
export async function recomputeDeadline(
  gameweekId: string
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const { settings } = await getActiveSeasonContext();
  const rows = await db
    .select({ kickoff: fixtures.kickoff })
    .from(fixtures)
    .where(eq(fixtures.gameweekId, gameweekId));
  if (rows.length === 0) return fail("no_fixtures");

  const first = rows.reduce(
    (min, r) => (r.kickoff < min ? r.kickoff : min),
    rows[0].kickoff
  );
  const deadline = new Date(
    first.getTime() - settings.deadlineOffsetMinutes * 60_000
  );

  await db
    .update(gameweeks)
    .set({ deadline })
    .where(eq(gameweeks.id, gameweekId));
  revalidateAll();
  return ok;
}

/** What a gameweek would take with it — drives the confirm dialog copy. */
type GameweekUsage = {
  fixtures: number;
  lineups: number;
  transfers: number;
  chips: number;
  finished: boolean;
};

/**
 * Deliberately not exported. Every export of a "use server" module is a live
 * endpoint that anyone holding the action id can POST to, and this one was
 * reachable by any signed-in user: it leaks how many lineups, transfers and
 * chips a gameweek holds, and runs five queries per call. Its only caller is
 * deleteGameweek below, which does its own admin check — so keeping it module
 * local removes the endpoint instead of guarding it.
 */
async function getGameweekUsage(id: string): Promise<GameweekUsage> {
  const [gameweek, fx, lineups, tf, chips] = await Promise.all([
    db
      .select({ status: gameweeks.status })
      .from(gameweeks)
      .where(eq(gameweeks.id, id))
      .limit(1),
    db.select({ n: count() }).from(fixtures).where(eq(fixtures.gameweekId, id)),
    db
      .select({ n: count() })
      .from(gameweekLineups)
      .where(eq(gameweekLineups.gameweekId, id)),
    db
      .select({ n: count() })
      .from(transfers)
      .where(eq(transfers.gameweekId, id)),
    db
      .select({ n: count() })
      .from(chipPlays)
      .where(eq(chipPlays.gameweekId, id)),
  ]);

  return {
    fixtures: fx[0]?.n ?? 0,
    lineups: lineups[0]?.n ?? 0,
    transfers: tf[0]?.n ?? 0,
    chips: chips[0]?.n ?? 0,
    finished: gameweek[0]?.status === "finished",
  };
}

/**
 * Deletes a gameweek. Four tables reference gameweeks and none of them cascade,
 * so the dependants have to go first or Postgres raises a foreign-key error.
 *
 * `cascade` also removes this gameweek's lineups, transfers and chip plays —
 * needed because every team gets a lineup row at onboarding, which would
 * otherwise make a mistakenly-created gameweek undeletable forever. Refused
 * once the gameweek is finished: its points are already banked in
 * fantasy_teams.totalPoints and removing it would silently corrupt totals.
 */
export async function deleteGameweek(
  id: string,
  cascade = false
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const usage = await getGameweekUsage(id);
  if (usage.finished) return fail("gameweek_finished");
  if (usage.fixtures > 0) return fail("in_use");

  const hasDependants =
    usage.lineups > 0 || usage.transfers > 0 || usage.chips > 0;
  if (hasDependants && !cascade) return fail("in_use");

  try {
    await db.transaction(async (tx) => {
      if (cascade) {
        await tx.delete(lineupPicks).where(
          inArray(
            lineupPicks.lineupId,
            tx
              .select({ id: gameweekLineups.id })
              .from(gameweekLineups)
              .where(eq(gameweekLineups.gameweekId, id))
          )
        );
        await tx
          .delete(gameweekLineups)
          .where(eq(gameweekLineups.gameweekId, id));
        await tx.delete(transfers).where(eq(transfers.gameweekId, id));
        await tx.delete(chipPlays).where(eq(chipPlays.gameweekId, id));
      }
      await tx.delete(gameweeks).where(eq(gameweeks.id, id));
    });
  } catch (err) {
    return dbFailure("deleteGameweek", err);
  }

  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export async function saveFixture(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const id = str(formData, "id");
  const gameweekId = str(formData, "gameweekId");
  const homeClubId = str(formData, "homeClubId");
  const awayClubId = str(formData, "awayClubId");
  const kickoff = parseAstDateTime(str(formData, "kickoff"));

  if (!gameweekId || !homeClubId || !awayClubId || !kickoff) {
    return fail("validation");
  }
  if (homeClubId === awayClubId) return fail("same_clubs");

  try {
    if (id) {
      await db
        .update(fixtures)
        .set({ homeClubId, awayClubId, kickoff })
        .where(eq(fixtures.id, id));
    } else {
      await db
        .insert(fixtures)
        .values({ gameweekId, homeClubId, awayClubId, kickoff });
    }
  } catch {
    return fail("unknown");
  }
  revalidateAll();
  return ok;
}

export async function deleteFixture(id: string): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const [statCount] = await db
    .select({ n: count() })
    .from(playerMatchStats)
    .where(eq(playerMatchStats.fixtureId, id));
  if (statCount.n > 0) return fail("in_use");

  try {
    await db.delete(fixtures).where(eq(fixtures.id, id));
  } catch (err) {
    return dbFailure("deleteFixture", err);
  }
  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Match result + player stats
// ---------------------------------------------------------------------------

export type PlayerStatInput = {
  playerId: string;
  minutes: number;
  goals: number;
  assists: number;
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
};

// ---------------------------------------------------------------------------
// Live match console
// ---------------------------------------------------------------------------

export type LiveStatLine = PlayerStatInput & {
  started: boolean;
  onMinute: number | null;
  offMinute: number | null;
};

export type SaveMatchProgressInput = {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  /** Match clock the minutes are derived against. */
  currentMinute: number;
  lines: LiveStatLine[];
  bonus?: { first?: string; second?: string; third?: string };
  /** true = publish the final result and close the match. */
  publish?: boolean;
};

/**
 * Writes the current state of a match. Called repeatedly while a match is in
 * play (`publish: false`, fixture stays live so points tick up for everyone)
 * and once at the end (`publish: true`, minutes frozen at full time and the
 * fixture closed so the gameweek can be finalized).
 */
export async function saveMatchProgress(
  input: SaveMatchProgressInput
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const { fixtureId, homeScore, awayScore, lines, bonus, publish } = input;
  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return fail("validation");
  }

  const [fixture] = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  if (!fixture) return fail("validation");

  // Published results are scored at full time; a live save uses the clock.
  const clock = publish
    ? FULL_TIME_MINUTE
    : Math.min(Math.max(input.currentMinute, 0), FULL_TIME_MINUTE);

  const { season } = await getActiveSeasonContext();
  const [rules, clubPlayers] = await Promise.all([
    db
      .select({
        eventKey: scoringRules.eventKey,
        position: scoringRules.position,
        points: scoringRules.points,
      })
      .from(scoringRules)
      .where(eq(scoringRules.seasonId, season.id)),
    db
      .select({
        id: players.id,
        position: players.position,
        clubId: players.clubId,
      })
      .from(players)
      .where(
        or(
          eq(players.clubId, fixture.homeClubId),
          eq(players.clubId, fixture.awayClubId)
        )
      ),
  ]);
  const rule = buildRuleLookup(rules);
  const playerById = new Map(clubPlayers.map((p) => [p.id, p]));

  const bonusFor = (playerId: string): number =>
    bonus?.first === playerId
      ? 3
      : bonus?.second === playerId
        ? 2
        : bonus?.third === playerId
          ? 1
          : 0;

  const rows: (typeof playerMatchStats.$inferInsert)[] = [];
  for (const line of lines) {
    const player = playerById.get(line.playerId);
    if (!player) return fail("validation");

    const minutes = minutesPlayed(
      {
        started: line.started,
        onMinute: line.onMinute,
        offMinute: line.offMinute,
      },
      clock
    );
    // Never took the field and recorded nothing — don't store an empty row.
    if (minutes === 0 && !line.started && line.onMinute == null) continue;

    const isHome = player.clubId === fixture.homeClubId;
    const conceded = isHome ? awayScore : homeScore;
    const statLine = {
      minutes,
      goals: Math.max(line.goals, 0),
      assists: Math.max(line.assists, 0),
      saves: Math.max(line.saves, 0),
      penaltiesSaved: Math.max(line.penaltiesSaved, 0),
      penaltiesMissed: Math.max(line.penaltiesMissed, 0),
      goalsConceded: conceded,
      // Clean sheets only make sense once the match is over.
      cleanSheet: Boolean(publish) && conceded === 0 && minutes >= 60,
      yellowCards: Math.max(line.yellowCards, 0),
      redCards: Math.max(line.redCards, 0),
      ownGoals: Math.max(line.ownGoals, 0),
      bonusPoints: bonusFor(line.playerId),
    };

    rows.push({
      fixtureId,
      playerId: line.playerId,
      ...statLine,
      started: line.started,
      onMinute: line.started ? 0 : line.onMinute,
      offMinute: line.offMinute,
      points: computePoints(statLine, player.position, rule),
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(playerMatchStats)
        .where(eq(playerMatchStats.fixtureId, fixtureId));
      if (rows.length > 0) await tx.insert(playerMatchStats).values(rows);
      await tx
        .update(fixtures)
        .set({
          homeScore,
          awayScore,
          status: publish ? "finished" : "live",
        })
        .where(eq(fixtures.id, fixtureId));
    });
  } catch (err) {
    return dbFailure("saveMatchProgress", err);
  }

  revalidateAll();
  return ok;
}

/** Reopens a published match for corrections. */
export async function reopenMatch(
  fixtureId: string
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");
  try {
    await db
      .update(fixtures)
      .set({ status: "live" })
      .where(eq(fixtures.id, fixtureId));
  } catch (err) {
    return dbFailure("reopenMatch", err);
  }
  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Gameweek finalization (the engine)
// ---------------------------------------------------------------------------

export async function finalizeGameweek(
  gameweekId: string
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const result = await runFinalizeGameweek(gameweekId);
  if (result.error) return fail(result.error);

  revalidateAll();
  return ok;
}

/** Reverses a finalize so a wrong result can be corrected and re-run. */
export async function unfinalizeGameweek(
  gameweekId: string
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const result = await runUnfinalizeGameweek(gameweekId);
  if (result.error) return fail(result.error);

  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Scoring rules
// ---------------------------------------------------------------------------

export async function saveScoringRules(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const { season } = await getActiveSeasonContext();
  const updates: Array<{ id: string; points: number }> = [];

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("rule-")) continue;
    const points = Number(raw);
    if (!Number.isInteger(points) || Math.abs(points) > 50) {
      return fail("validation");
    }
    updates.push({ id: key.slice(5), points });
  }
  if (updates.length === 0) return fail("validation");

  try {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(scoringRules)
          .set({ points: update.points })
          .where(
            and(
              eq(scoringRules.id, update.id),
              eq(scoringRules.seasonId, season.id)
            )
          );
      }
    });
  } catch {
    return fail("unknown");
  }

  revalidateAll();
  return ok;
}

// ---------------------------------------------------------------------------
// Game settings
// ---------------------------------------------------------------------------

const SETTINGS_FIELDS = [
  "budget",
  "squadSize",
  "gkCount",
  "defCount",
  "midCount",
  "fwdCount",
  "startingSize",
  "minDef",
  "minMid",
  "minFwd",
  "maxPerClub",
  "freeTransfersPerGw",
  "maxBankedTransfers",
  "transferHitCost",
  "deadlineOffsetMinutes",
  "wildcardsPerSeason",
] as const;

export async function saveSettings(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const values: Record<string, number> = {};
  for (const field of SETTINGS_FIELDS) {
    const value = num(formData, field);
    if (!Number.isInteger(value) || value < 0) return fail("validation");
    values[field] = value;
  }

  const { season } = await getActiveSeasonContext();
  await db
    .update(gameSettings)
    .set(values)
    .where(eq(gameSettings.seasonId, season.id));

  revalidateAll();
  return ok;
}
