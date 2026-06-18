import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Globe, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import {
  getActiveSeasonContext,
  getUserFantasyTeam,
} from "@/lib/game/queries";
import { getMyLeagues, getMyOverallStanding } from "@/lib/game/leagues";
import { LeagueActions } from "@/components/leagues/league-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("leagues") };
}

export default async function LeaguesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { season } = await getActiveSeasonContext();
  const team = await getUserFantasyTeam(user.id, season.id);
  if (!team) redirect("/onboarding");

  const [t, overall, myLeagues] = await Promise.all([
    getTranslations("leagues"),
    getMyOverallStanding(season.id, team.id),
    getMyLeagues(team.id, user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-heading text-2xl">{t("title")}</h1>

      {/* Overall league */}
      <Link
        href="/leagues/overall"
        className="mt-5 flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Globe className="size-5 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t("overall")}</span>
          <span className="block text-xs text-muted-foreground">
            {overall
              ? t("overallSub", {
                  rank: overall.rank,
                  managers: overall.managers,
                })
              : t("overallSubEmpty")}
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      {/* Private leagues */}
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-lg">{t("private")}</h2>
        <LeagueActions />

        <ul className="mt-4 flex flex-col gap-2">
          {myLeagues.map((league) => (
            <li key={league.id}>
              <Link
                href={`/leagues/${league.id}`}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {league.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("leagueSub", {
                      rank: league.myRank,
                      members: league.memberCount,
                    })}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
          {myLeagues.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noLeagues")}
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
