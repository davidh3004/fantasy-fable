import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { gameweeks } from "@/db/schema";
import { formatKickoff } from "@/lib/game/format";
import {
  getActiveSeasonContext,
  getFixturesForGameweek,
} from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("results") };
}

export default async function AdminResultsPage() {
  const { season } = await getActiveSeasonContext();
  const [t, locale] = await Promise.all([
    getTranslations("admin.results"),
    getLocale(),
  ]);

  const gameweekRows = await db
    .select()
    .from(gameweeks)
    .where(eq(gameweeks.seasonId, season.id))
    .orderBy(asc(gameweeks.number));

  const sections = await Promise.all(
    gameweekRows.map(async (gw) => ({
      gw,
      fixtures: await getFixturesForGameweek(gw.id),
    }))
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {sections.map(({ gw, fixtures }) => (
        <section key={gw.id}>
          <h2 className="mb-2 font-heading text-lg">
            {t("gameweek", { number: gw.number })}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {fixtures.map((fixture) => (
              <li key={fixture.id}>
                <Link
                  href={`/admin/results/${fixture.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {fixture.homeName}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {fixture.homeScore != null && fixture.awayScore != null
                          ? `${fixture.homeScore} - ${fixture.awayScore}`
                          : "vs"}
                      </span>{" "}
                      {fixture.awayName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatKickoff(fixture.kickoff, locale)}
                    </span>
                  </span>
                  {fixture.status === "finished" ? (
                    <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">
                      {t("entered")}
                    </span>
                  ) : (
                    <span className="rounded-md bg-yellow-400/15 px-2 py-0.5 text-xs text-yellow-300">
                      {t("pendingEntry")}
                    </span>
                  )}
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
            {fixtures.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t("noFixtures")}
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
