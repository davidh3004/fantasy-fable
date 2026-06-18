"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { gameweekLineups, lineupPicks } from "@/db/schema";
import {
  orderLineupForSlots,
  validateLineup,
  type LineupState,
} from "@/lib/game/lineup";
import {
  getActiveSeasonContext,
  getNextGameweek,
  getSquadPlayers,
  getUserFantasyTeam,
  toSquadSettings,
} from "@/lib/game/queries";

export type SaveLineupInput = LineupState & {
  captainId: string;
  viceId: string;
};

export type SaveLineupState = { error?: string; success?: boolean };

export async function saveLineup(
  input: SaveLineupInput
): Promise<SaveLineupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unknown" };

  const { season, settings } = await getActiveSeasonContext();
  const squadSettings = toSquadSettings(settings);

  const [team, nextGameweek] = await Promise.all([
    getUserFantasyTeam(user.id, season.id),
    getNextGameweek(season.id),
  ]);
  if (!team) return { error: "no_team" };
  if (!nextGameweek || nextGameweek.deadline <= new Date()) {
    return { error: "deadline_passed" };
  }

  // Authoritative squad from the DB — the client only sends ids.
  const squad = await getSquadPlayers(team.id);

  const lineupError = validateLineup({
    squad,
    starterIds: input.starterIds,
    benchIds: input.benchIds,
    captainId: input.captainId,
    viceId: input.viceId,
    settings: squadSettings,
  });
  if (lineupError) return { error: lineupError };

  const byId = new Map(squad.map((p) => [p.id, p]));
  const orderedIds = orderLineupForSlots(
    { starterIds: input.starterIds, benchIds: input.benchIds },
    byId
  );

  try {
    await db.transaction(async (tx) => {
      const [lineupRow] = await tx
        .insert(gameweekLineups)
        .values({
          fantasyTeamId: team.id,
          gameweekId: nextGameweek.id,
        })
        .onConflictDoUpdate({
          target: [gameweekLineups.fantasyTeamId, gameweekLineups.gameweekId],
          set: { gameweekId: nextGameweek.id }, // no-op, just to get RETURNING
        })
        .returning();

      await tx
        .delete(lineupPicks)
        .where(eq(lineupPicks.lineupId, lineupRow.id));

      await tx.insert(lineupPicks).values(
        orderedIds.map((playerId, index) => ({
          lineupId: lineupRow.id,
          playerId,
          slot: index + 1,
          isCaptain: playerId === input.captainId,
          isVice: playerId === input.viceId,
        }))
      );
    });
  } catch (err) {
    console.error("saveLineup failed:", err);
    return { error: "unknown" };
  }

  revalidatePath("/team");
  return { success: true };
}
