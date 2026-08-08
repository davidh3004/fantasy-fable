"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { miniLeagueMembers, miniLeagues } from "@/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getActiveSeasonContext, getUserFantasyTeam } from "@/lib/game/queries";

/**
 * An invite code is 6 characters over a 32-symbol alphabet. That is a large
 * space, but only if guesses cost something — with unlimited attempts a bot
 * can work through it and land in private leagues. 15 tries per 10 minutes is
 * far more than anyone typing a code they were given.
 */
const JOIN_ATTEMPTS = 15;
const JOIN_WINDOW_SECONDS = 10 * 60;

/** Enough leagues for any real use; a cap stops scripted table-filling. */
const MAX_LEAGUES_OWNED = 20;

export type LeagueState = {
  error?: string;
  code?: string;
  leagueId?: string;
};

// Unambiguous alphabet (no 0/O/1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6): string {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

async function currentTeam() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { season } = await getActiveSeasonContext();
  const team = await getUserFantasyTeam(user.id, season.id);
  if (!team) return null;
  return { userId: user.id, team, seasonId: season.id };
}

export async function createLeague(
  _prev: LeagueState,
  formData: FormData
): Promise<LeagueState> {
  const ctx = await currentTeam();
  if (!ctx) return { error: "no_team" };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3 || name.length > 40) return { error: "name_invalid" };

  // Counted from the leagues themselves rather than a limiter: "how many
  // leagues may one manager run" is a rule about the game, not about traffic,
  // and it should not reset with a time window.
  const [owned] = await db
    .select({ n: count() })
    .from(miniLeagues)
    .where(
      and(
        eq(miniLeagues.ownerId, ctx.userId),
        eq(miniLeagues.seasonId, ctx.seasonId)
      )
    );
  if ((owned?.n ?? 0) >= MAX_LEAGUES_OWNED) {
    return { error: "too_many_leagues" };
  }

  // Retry on the (rare) invite-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const leagueId = await db.transaction(async (tx) => {
        const [league] = await tx
          .insert(miniLeagues)
          .values({
            seasonId: ctx.seasonId,
            name,
            inviteCode: code,
            ownerId: ctx.userId,
          })
          .returning({ id: miniLeagues.id });
        await tx.insert(miniLeagueMembers).values({
          leagueId: league.id,
          fantasyTeamId: ctx.team.id,
        });
        return league.id;
      });
      revalidatePath("/leagues");
      return { code, leagueId };
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") continue; // dup code
      console.error("createLeague failed:", err);
      return { error: "unknown" };
    }
  }
  return { error: "unknown" };
}

export async function joinLeague(
  _prev: LeagueState,
  formData: FormData
): Promise<LeagueState> {
  const ctx = await currentTeam();
  if (!ctx) return { error: "no_team" };

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) return { error: "code_invalid" };

  // Counted before the lookup, so guesses are what's limited — not successes.
  const limit = await consumeRateLimit(
    `join-league:${ctx.userId}`,
    JOIN_ATTEMPTS,
    JOIN_WINDOW_SECONDS
  );
  if (!limit.allowed) return { error: "rate_limited" };

  const [league] = await db
    .select({ id: miniLeagues.id, seasonId: miniLeagues.seasonId })
    .from(miniLeagues)
    .where(eq(miniLeagues.inviteCode, code))
    .limit(1);
  if (!league) return { error: "not_found" };
  if (league.seasonId !== ctx.seasonId) return { error: "wrong_season" };

  const [existing] = await db
    .select({ id: miniLeagueMembers.id })
    .from(miniLeagueMembers)
    .where(
      and(
        eq(miniLeagueMembers.leagueId, league.id),
        eq(miniLeagueMembers.fantasyTeamId, ctx.team.id)
      )
    )
    .limit(1);
  if (existing) return { error: "already_member", leagueId: league.id };

  await db.insert(miniLeagueMembers).values({
    leagueId: league.id,
    fantasyTeamId: ctx.team.id,
  });
  revalidatePath("/leagues");
  return { leagueId: league.id };
}

export async function leaveLeague(leagueId: string): Promise<LeagueState> {
  const ctx = await currentTeam();
  if (!ctx) return { error: "no_team" };

  await db
    .delete(miniLeagueMembers)
    .where(
      and(
        eq(miniLeagueMembers.leagueId, leagueId),
        eq(miniLeagueMembers.fantasyTeamId, ctx.team.id)
      )
    );
  revalidatePath("/leagues");
  return {};
}
