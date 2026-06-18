import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Globe } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import {
  getActiveSeasonContext,
  getUserFantasyTeam,
} from "@/lib/game/queries";
import {
  getLeagueForMember,
  getMyOverallStanding,
  getStandings,
} from "@/lib/game/leagues";
import { StandingsTable } from "@/components/leagues/standings-table";
import { LeaveLeagueButton } from "@/components/leagues/leave-button";
import { InviteCode } from "@/components/leagues/invite-code";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("leagues") };
}

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { season } = await getActiveSeasonContext();
  const team = await getUserFantasyTeam(user.id, season.id);
  if (!team) redirect("/onboarding");

  const t = await getTranslations("leagues");

  // Global overall league.
  if (id === "overall") {
    const [standings, overall] = await Promise.all([
      getStandings({ seasonId: season.id, myTeamId: team.id }),
      getMyOverallStanding(season.id, team.id),
    ]);
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="mt-3 mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
            <Globe className="size-5 text-primary" aria-hidden />
          </span>
          <div>
            <h1 className="font-heading text-xl">{t("overall")}</h1>
            {overall && (
              <p className="text-xs text-muted-foreground">
                {t("overallSub", {
                  rank: overall.rank,
                  managers: overall.managers,
                })}
              </p>
            )}
          </div>
        </div>
        <StandingsTable rows={standings} backHref="/leagues/overall" />
        {standings.length >= 100 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("topLimit", { count: 100 })}
          </p>
        )}
      </main>
    );
  }

  // Private league — must be a member.
  const league = await getLeagueForMember(id, team.id);
  if (!league) notFound();

  const standings = await getStandings({
    seasonId: season.id,
    myTeamId: team.id,
    leagueId: league.id,
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/leagues"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl">{league.name}</h1>
          <p className="text-xs text-muted-foreground">
            {t("memberCount", { count: standings.length })}
          </p>
        </div>
        <LeaveLeagueButton leagueId={league.id} leagueName={league.name} />
      </div>

      <div className="mt-4">
        <InviteCode code={league.inviteCode} />
      </div>

      <div className="mt-5">
        <StandingsTable rows={standings} backHref={`/leagues/${league.id}`} />
      </div>
    </main>
  );
}
