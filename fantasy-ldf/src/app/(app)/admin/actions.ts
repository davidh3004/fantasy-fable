"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  fixtures,
  gameSettings,
  gameweeks,
  lineupPicks,
  playerMatchStats,
  players,
  scoringRules,
  squadPicks,
  transfers,
} from "@/db/schema";
import { runFinalizeGameweek } from "@/lib/game/finalize";
import { requireAdminAction } from "@/lib/admin";
import { pickedFile, uploadImage } from "@/lib/storage";
import { buildRuleLookup, computePoints } from "@/lib/game/scoring";
import { getActiveSeasonContext } from "@/lib/game/queries";
import type { Position } from "@/lib/game/squad";

export type AdminActionState = { error?: string; success?: boolean };

const ok: AdminActionState = { success: true };
const fail = (error: string): AdminActionState => ({ error });

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

  await db.delete(clubs).where(eq(clubs.id, id));
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

  await db.delete(players).where(eq(players.id, id));
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

export async function deleteGameweek(id: string): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const [fixtureCount] = await db
    .select({ n: count() })
    .from(fixtures)
    .where(eq(fixtures.gameweekId, id));
  if (fixtureCount.n > 0) return fail("in_use");

  await db.delete(gameweeks).where(eq(gameweeks.id, id));
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

  await db.delete(fixtures).where(eq(fixtures.id, id));
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

export type SaveResultInput = {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  stats: PlayerStatInput[];
  bonus: { first?: string; second?: string; third?: string }; // 3 / 2 / 1 pts
};

export async function saveMatchResult(
  input: SaveResultInput
): Promise<AdminActionState> {
  if (!(await requireAdminAction())) return fail("forbidden");

  const { fixtureId, homeScore, awayScore, stats, bonus } = input;
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

  const { season } = await getActiveSeasonContext();
  const rules = await db
    .select({
      eventKey: scoringRules.eventKey,
      position: scoringRules.position,
      points: scoringRules.points,
    })
    .from(scoringRules)
    .where(eq(scoringRules.seasonId, season.id));
  const rule = buildRuleLookup(rules);

  // Authoritative player info (position + club side)
  const clubPlayers = await db
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
    );
  const playerById = new Map(clubPlayers.map((p) => [p.id, p]));

  const bonusFor = (playerId: string): number =>
    bonus.first === playerId
      ? 3
      : bonus.second === playerId
        ? 2
        : bonus.third === playerId
          ? 1
          : 0;

  const rows: (typeof playerMatchStats.$inferInsert)[] = [];
  for (const line of stats) {
    const player = playerById.get(line.playerId);
    if (!player) return fail("validation");
    if (line.minutes <= 0) continue; // only players who actually played

    const isHome = player.clubId === fixture.homeClubId;
    const conceded = isHome ? awayScore : homeScore;
    const statLine = {
      minutes: Math.min(Math.max(line.minutes, 0), 120),
      goals: Math.max(line.goals, 0),
      assists: Math.max(line.assists, 0),
      saves: Math.max(line.saves, 0),
      penaltiesSaved: Math.max(line.penaltiesSaved, 0),
      penaltiesMissed: Math.max(line.penaltiesMissed, 0),
      goalsConceded: conceded,
      cleanSheet: conceded === 0 && line.minutes >= 60,
      yellowCards: Math.max(line.yellowCards, 0),
      redCards: Math.max(line.redCards, 0),
      ownGoals: Math.max(line.ownGoals, 0),
      bonusPoints: bonusFor(line.playerId),
    };

    rows.push({
      fixtureId,
      playerId: line.playerId,
      ...statLine,
      points: computePoints(statLine, player.position, rule),
    });
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(playerMatchStats)
        .where(eq(playerMatchStats.fixtureId, fixtureId));
      if (rows.length > 0) {
        await tx.insert(playerMatchStats).values(rows);
      }
      await tx
        .update(fixtures)
        .set({ homeScore, awayScore, status: "finished" })
        .where(eq(fixtures.id, fixtureId));
    });
  } catch (err) {
    console.error("saveMatchResult failed:", err);
    return fail("unknown");
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
