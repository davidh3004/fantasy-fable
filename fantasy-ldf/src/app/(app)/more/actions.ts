"use server";

import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  chipPlays,
  fantasyTeams,
  gameweekLineups,
  lineupPicks,
  miniLeagueMembers,
  miniLeagues,
  profiles,
  squadPicks,
  transfers,
} from "@/db/schema";

export type DeleteAccountState = { error?: string };

/**
 * Erases an account and everything attached to it, on the account holder's own
 * say-so.
 *
 * This is the right to erasure made into a button. Handling it by email would
 * be legal too, but it depends on someone reading that email and remembering
 * the delete order — and the tables here have no ON DELETE CASCADE, so "delete
 * the account" by hand is a dozen statements that have to run in the right
 * sequence. Doing it in one transaction is both kinder to the user and far
 * more likely to actually be correct.
 *
 * Identity is re-checked against the auth server rather than read from the
 * session cookie: this is the most destructive action in the app and the one
 * place where a stale token must not be enough.
 */
export async function deleteAccount(): Promise<DeleteAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    await db.transaction(async (tx) => {
      const teams = await tx
        .select({ id: fantasyTeams.id })
        .from(fantasyTeams)
        .where(eq(fantasyTeams.userId, user.id));
      const teamIds = teams.map((team) => team.id);

      if (teamIds.length > 0) {
        const lineups = await tx
          .select({ id: gameweekLineups.id })
          .from(gameweekLineups)
          .where(inArray(gameweekLineups.fantasyTeamId, teamIds));
        const lineupIds = lineups.map((lineup) => lineup.id);

        if (lineupIds.length > 0) {
          await tx
            .delete(lineupPicks)
            .where(inArray(lineupPicks.lineupId, lineupIds));
        }
        await tx
          .delete(gameweekLineups)
          .where(inArray(gameweekLineups.fantasyTeamId, teamIds));
        await tx
          .delete(squadPicks)
          .where(inArray(squadPicks.fantasyTeamId, teamIds));
        await tx
          .delete(transfers)
          .where(inArray(transfers.fantasyTeamId, teamIds));
        await tx
          .delete(chipPlays)
          .where(inArray(chipPlays.fantasyTeamId, teamIds));
      }

      /**
       * Private leagues this account created are handed to whoever joined
       * first, not destroyed. One person exercising their own right to be
       * forgotten should not take a league — and everyone else's standing in
       * it — down with them. A league left with nobody else in it has nothing
       * to hand over and goes.
       */
      const owned = await tx
        .select({ id: miniLeagues.id })
        .from(miniLeagues)
        .where(eq(miniLeagues.ownerId, user.id));

      for (const league of owned) {
        const [heir] = await tx
          .select({ userId: fantasyTeams.userId })
          .from(miniLeagueMembers)
          .innerJoin(
            fantasyTeams,
            eq(fantasyTeams.id, miniLeagueMembers.fantasyTeamId)
          )
          .where(
            and(
              eq(miniLeagueMembers.leagueId, league.id),
              ne(fantasyTeams.userId, user.id)
            )
          )
          .orderBy(asc(miniLeagueMembers.joinedAt))
          .limit(1);

        if (heir) {
          await tx
            .update(miniLeagues)
            .set({ ownerId: heir.userId })
            .where(eq(miniLeagues.id, league.id));
        } else {
          await tx
            .delete(miniLeagueMembers)
            .where(eq(miniLeagueMembers.leagueId, league.id));
          await tx.delete(miniLeagues).where(eq(miniLeagues.id, league.id));
        }
      }

      if (teamIds.length > 0) {
        await tx
          .delete(miniLeagueMembers)
          .where(inArray(miniLeagueMembers.fantasyTeamId, teamIds));
        await tx.delete(fantasyTeams).where(inArray(fantasyTeams.id, teamIds));
      }

      await tx.delete(profiles).where(eq(profiles.id, user.id));

      // The login itself. Drizzle only models the public schema, so this is
      // the one place that reaches into auth — identities first, since they
      // point at the user row.
      await tx.execute(
        sql`delete from auth.identities where user_id = ${user.id}::uuid`
      );
      await tx.execute(
        sql`delete from auth.users where id = ${user.id}::uuid`
      );
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "delete-account" } });
    console.error("deleteAccount failed:", err);
    return { error: "unknown" };
  }

  // The account is gone; clear the cookie so the browser isn't left holding a
  // token for a user that no longer exists.
  await supabase.auth.signOut();
  redirect("/login");
}
