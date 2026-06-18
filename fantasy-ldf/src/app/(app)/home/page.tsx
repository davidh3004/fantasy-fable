import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, Shirt } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { Button } from "@/components/ui/button";
import { DeadlineCountdown } from "@/components/home/deadline-countdown";
import { formatDeadline, formatKickoff, formatMoney } from "@/lib/game/format";
import {
  getActiveSeasonContext,
  getFixturesForNextGameweek,
  getLatestLineupForUser,
  getNextGameweek,
  getUserFantasyTeam,
  type FixtureWithClubs,
} from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

function ClubBadge({
  shortName,
  color,
}: {
  shortName: string;
  color: string | null;
}) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: color ?? "#7c3aed" }}
      aria-hidden
    >
      {shortName}
    </span>
  );
}

function FixtureRow({
  fixture,
  locale,
}: {
  fixture: FixtureWithClubs;
  locale: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <span className="min-w-0 truncate text-right text-sm font-medium">
          {fixture.homeName}
        </span>
        <ClubBadge shortName={fixture.homeShort} color={fixture.homeColor} />
      </div>
      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
        {formatKickoff(fixture.kickoff, locale)}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClubBadge shortName={fixture.awayShort} color={fixture.awayColor} />
        <span className="min-w-0 truncate text-sm font-medium">
          {fixture.awayName}
        </span>
      </div>
    </li>
  );
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Season context is TTL-cached; everything else runs in one parallel stage.
  const { season } = await getActiveSeasonContext();

  const [team, nextGameweek, latestLineup, gameweekFixtures, t, locale] =
    await Promise.all([
      getUserFantasyTeam(user.id, season.id),
      getNextGameweek(season.id),
      getLatestLineupForUser(user.id, season.id),
      getFixturesForNextGameweek(season.id),
      getTranslations("home"),
      getLocale(),
    ]);
  if (!team) redirect("/onboarding");

  const name = user.displayName || (user.email ?? "");

  const stats = [
    {
      key: "gwPoints",
      value: latestLineup?.points != null ? String(latestLineup.points) : "—",
    },
    { key: "totalPoints", value: String(team.totalPoints) },
    {
      key: "rank",
      value: team.overallRank != null ? `#${team.overallRank}` : "—",
    },
    { key: "bank", value: formatMoney(team.budget) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-sm text-muted-foreground">{t("greeting", { name })}</p>
      <h1 className="mt-0.5 font-heading text-3xl">{team.name}</h1>

      {/* Stats tiles */}
      <section className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map(({ key, value }) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(`stats.${key}`)}
            </p>
            <p className="mt-1 font-heading text-2xl tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {/* Deadline */}
      <section className="mt-6 overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card p-5">
        {nextGameweek ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("deadline.subtitle")}
              </p>
              <h2 className="mt-0.5 font-heading text-2xl">
                {t("deadline.title", { number: nextGameweek.number })}
              </h2>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {formatDeadline(nextGameweek.deadline, locale)}
              </p>
            </div>
            <DeadlineCountdown deadline={nextGameweek.deadline.toISOString()} />
          </div>
        ) : (
          <p className="text-muted-foreground">{t("deadline.noUpcoming")}</p>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-4 grid grid-cols-2 gap-2.5">
        <Button
          render={<Link href="/team" />}
          nativeButton={false}
          className="h-12 cursor-pointer font-semibold"
        >
          <Shirt className="size-4.5" aria-hidden />
          {t("actions.team")}
        </Button>
        <Button
          render={<Link href="/transfers" />}
          nativeButton={false}
          variant="outline"
          className="h-12 cursor-pointer font-semibold"
        >
          <ArrowLeftRight className="size-4.5" aria-hidden />
          {t("actions.transfers")}
        </Button>
      </section>

      {/* Fixtures */}
      {nextGameweek && (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg">
            {t("fixtures.title", { number: nextGameweek.number })}
          </h2>
          {gameweekFixtures.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {gameweekFixtures.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("fixtures.empty")}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
