"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  clubs,
  fantasyTeams,
  gameweekLineups,
  lineupPicks,
  players,
  profiles,
  squadPicks,
} from "@/db/schema";
import { squadCost, validateSquad, POSITION_ORDER } from "@/lib/game/squad";
import { validateLineup } from "@/lib/game/lineup";
import {
  getActiveSeasonContext,
  getNextGameweek,
  getUserFantasyTeam,
  toSquadSettings,
} from "@/lib/game/queries";

export type CreateTeamInput = {
  teamName: string;
  favoriteClubId: string | null;
  playerIds: string[];
  starterIds: string[];
  benchIds: string[]; // index 0 = backup GK, rest = outfield priority order
  captainId: string;
  viceId: string;
};

export type CreateTeamState = { error?: string };

export async function createFantasyTeam(
  input: CreateTeamInput
): Promise<CreateTeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teamName = input.teamName.trim();
  if (teamName.length < 3 || teamName.length > 30) {
    return { error: "team_name_invalid" };
  }

  const { season, settings } = await getActiveSeasonContext();
  const squadSettings = toSquadSettings(settings);

  const existing = await getUserFantasyTeam(user.id, season.id);
  if (existing) redirect("/home");

  const playerIds = [...new Set(input.playerIds)];
  if (playerIds.length !== settings.squadSize) {
    return { error: "squad_incomplete" };
  }

  // Authoritative data: prices and positions come from the DB, never the client.
  const pool = await db
    .select({
      id: players.id,
      position: players.position,
      price: players.price,
      clubId: players.clubId,
    })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(inArray(players.id, playerIds));

  if (pool.length !== playerIds.length) {
    return { error: "invalid_squad" };
  }

  const squadError = validateSquad(pool, squadSettings);
  if (squadError) return { error: squadError };

  const lineupError = validateLineup({
    squad: pool,
    starterIds: input.starterIds,
    benchIds: input.benchIds,
    captainId: input.captainId,
    viceId: input.viceId,
    settings: squadSettings,
  });
  if (lineupError) return { error: lineupError };

  if (input.favoriteClubId) {
    const [club] = await db
      .select({ id: clubs.id })
      .from(clubs)
      .where(eq(clubs.id, input.favoriteClubId))
      .limit(1);
    if (!club) return { error: "invalid_squad" };
  }

  /**
   * Never falls back to the email address.
   *
   * This name is public — it is what the standings, the league tables and your
   * team page show every other manager. Taking it from the local part of an
   * email turned `juan.perez@gmail.com` into a manager called "juan.perez",
   * publishing a piece of personal data the player never chose to share and
   * handing anyone a very good guess at their address. The registration form
   * asks for a username and Google supplies a name, so the fallback is only
   * ever reached by an account that gave us neither.
   */
  const displayName =
    (user.user_metadata.display_name as string | undefined) ??
    (user.user_metadata.name as string | undefined) ??
    "Míster";

  const nextGameweek = await getNextGameweek(season.id);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({
          id: user.id,
          displayName,
          favoriteClubId: input.favoriteClubId,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { favoriteClubId: input.favoriteClubId },
        });

      const [team] = await tx
        .insert(fantasyTeams)
        .values({
          userId: user.id,
          seasonId: season.id,
          name: teamName,
          budget: settings.budget - squadCost(pool),
          freeTransfers: settings.freeTransfersPerGw,
        })
        .returning();

      await tx.insert(squadPicks).values(
        pool.map((p) => ({
          fantasyTeamId: team.id,
          playerId: p.id,
          purchasePrice: p.price,
        }))
      );

      if (nextGameweek) {
        const [lineupRow] = await tx
          .insert(gameweekLineups)
          .values({
            fantasyTeamId: team.id,
            gameweekId: nextGameweek.id,
          })
          .returning();

        // Slots 1–11: starters in GK→DEF→MID→FWD order; 12: backup GK;
        // 13–15: outfield bench in the user's priority order.
        const poolById = new Map(pool.map((p) => [p.id, p]));
        const orderedStarters = [...input.starterIds].sort((a, b) => {
          const posA = POSITION_ORDER.indexOf(poolById.get(a)!.position);
          const posB = POSITION_ORDER.indexOf(poolById.get(b)!.position);
          return posA - posB;
        });

        const allSlots = [...orderedStarters, ...input.benchIds];
        await tx.insert(lineupPicks).values(
          allSlots.map((playerId, index) => ({
            lineupId: lineupRow.id,
            playerId,
            slot: index + 1,
            isCaptain: playerId === input.captainId,
            isVice: playerId === input.viceId,
          }))
        );
      }
    });
  } catch (err: unknown) {
    // Unique violation = double submit / already has a team this season.
    if ((err as { code?: string }).code === "23505") redirect("/home");
    Sentry.captureException(err);
    console.error("createFantasyTeam failed:", err);
    return { error: "unknown" };
  }

  // Celebration screen; it moves on to /home by itself.
  redirect("/onboarding/success");
}
