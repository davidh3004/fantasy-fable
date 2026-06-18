"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  clubs,
  fantasyTeams,
  gameweekLineups,
  lineupPicks,
  players,
  squadPicks,
  transfers as transfersTable,
} from "@/db/schema";
import {
  transferCost,
  validateTransferBatch,
  type TransferPair,
} from "@/lib/game/transfers";
import {
  getActiveSeasonContext,
  getNextGameweek,
  getSquadPlayers,
  getUserFantasyTeam,
  hasSeasonStarted,
  toSquadSettings,
} from "@/lib/game/queries";

export type MakeTransfersInput = {
  pairs: TransferPair[];
};

export type MakeTransfersState = { error?: string; success?: boolean };

export async function makeTransfers(
  input: MakeTransfersInput
): Promise<MakeTransfersState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unknown" };

  const pairs = input.pairs;
  if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > 15) {
    return { error: "invalid" };
  }

  const { season, settings } = await getActiveSeasonContext();
  const squadSettings = toSquadSettings(settings);

  const [team, nextGameweek, seasonStarted] = await Promise.all([
    getUserFantasyTeam(user.id, season.id),
    getNextGameweek(season.id),
    hasSeasonStarted(season.id),
  ]);
  if (!team) return { error: "no_team" };
  if (!nextGameweek || nextGameweek.deadline <= new Date()) {
    return { error: "deadline_passed" };
  }

  // Authoritative data: squad and incoming players from the DB.
  const squad = await getSquadPlayers(team.id);
  const incoming = await db
    .select({
      id: players.id,
      position: players.position,
      price: players.price,
      clubId: players.clubId,
    })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(
      and(
        inArray(
          players.id,
          pairs.map((p) => p.inId)
        ),
        eq(clubs.competitionId, season.competitionId)
      )
    );

  const poolById = new Map(
    [...squad, ...incoming].map((p) => [p.id, p])
  );

  const batchError = validateTransferBatch({
    squad,
    pairs,
    poolById,
    bank: team.budget,
    settings: squadSettings,
  });
  if (batchError) return { error: batchError };

  const cost = transferCost({
    count: pairs.length,
    freeTransfers: team.freeTransfers,
    hitCost: settings.transferHitCost,
    preSeason: !seasonStarted,
  });

  let bankDelta = 0;
  for (const pair of pairs) {
    bankDelta += poolById.get(pair.outId)!.price;
    bankDelta -= poolById.get(pair.inId)!.price;
  }

  try {
    await db.transaction(async (tx) => {
      // Record the transfers
      await tx.insert(transfersTable).values(
        pairs.map((pair, index) => ({
          fantasyTeamId: team.id,
          gameweekId: nextGameweek.id,
          playerInId: pair.inId,
          playerOutId: pair.outId,
          wasFree: !seasonStarted || index < cost.freeUsed,
        }))
      );

      // Swap squad picks
      await tx.delete(squadPicks).where(
        and(
          eq(squadPicks.fantasyTeamId, team.id),
          inArray(
            squadPicks.playerId,
            pairs.map((p) => p.outId)
          )
        )
      );
      await tx.insert(squadPicks).values(
        pairs.map((pair) => ({
          fantasyTeamId: team.id,
          playerId: pair.inId,
          purchasePrice: poolById.get(pair.inId)!.price,
        }))
      );

      // Update bank + remaining free transfers
      await tx
        .update(fantasyTeams)
        .set({
          budget: team.budget + bankDelta,
          freeTransfers: seasonStarted
            ? team.freeTransfers - cost.freeUsed
            : team.freeTransfers,
        })
        .where(eq(fantasyTeams.id, team.id));

      // Replace outgoing players in the upcoming lineup (same slot, same
      // captain/vice flags) and accumulate the points hit.
      const [lineupRow] = await tx
        .select({ id: gameweekLineups.id, transfersCost: gameweekLineups.transfersCost })
        .from(gameweekLineups)
        .where(
          and(
            eq(gameweekLineups.fantasyTeamId, team.id),
            eq(gameweekLineups.gameweekId, nextGameweek.id)
          )
        )
        .limit(1);

      if (lineupRow) {
        for (const pair of pairs) {
          await tx
            .update(lineupPicks)
            .set({ playerId: pair.inId })
            .where(
              and(
                eq(lineupPicks.lineupId, lineupRow.id),
                eq(lineupPicks.playerId, pair.outId)
              )
            );
        }
        if (cost.points > 0) {
          await tx
            .update(gameweekLineups)
            .set({ transfersCost: lineupRow.transfersCost + cost.points })
            .where(eq(gameweekLineups.id, lineupRow.id));
        }
      }
    });
  } catch (err) {
    console.error("makeTransfers failed:", err);
    return { error: "unknown" };
  }

  revalidatePath("/transfers");
  revalidatePath("/team");
  revalidatePath("/home");
  return { success: true };
}
