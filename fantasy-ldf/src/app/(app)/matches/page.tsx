import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { ClubCrest } from "@/components/shared/club-badge";
import { cn } from "@/lib/utils";
import { formatKickoff } from "@/lib/game/format";
import {
  getActiveSeasonContext,
  getFixturesForGameweek,
  getSeasonGameweeks,
  type FixtureWithClubs,
} from "@/lib/game/queries";
import {
  effectiveFixtureStatus,
  effectiveGameweekStatus,
} from "@/lib/game/status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("matches") };
}

function FixtureRow({
  fixture,
  locale,
  liveLabel,
}: {
  fixture: FixtureWithClubs;
  locale: string;
  liveLabel: string;
}) {
  const played = fixture.homeScore != null && fixture.awayScore != null;
  const isLive = effectiveFixtureStatus(fixture) === "live";
  return (
    <li>
      <Link
        href={`/matches/${fixture.id}`}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/50"
      >
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="min-w-0 truncate text-right text-sm font-medium">
            {fixture.homeName}
          </span>
          <ClubCrest
            shortName={fixture.homeShort}
            name={fixture.homeName}
            color={fixture.homeColor}
            badgeUrl={fixture.homeBadgeUrl}
          />
        </div>

        <div className="flex shrink-0 flex-col items-center">
          {played ? (
            <span className="rounded-md bg-muted px-2 py-0.5 font-heading text-sm tabular-nums">
              {fixture.homeScore} - {fixture.awayScore}
            </span>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatKickoff(fixture.kickoff, locale)}
            </span>
          )}
          {isLive && (
            <span className="mt-0.5 rounded bg-destructive px-1.5 text-[10px] font-semibold uppercase text-white">
              {liveLabel}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ClubCrest
            shortName={fixture.awayShort}
            name={fixture.awayName}
            color={fixture.awayColor}
            badgeUrl={fixture.awayBadgeUrl}
          />
          <span className="min-w-0 truncate text-sm font-medium">
            {fixture.awayName}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { gw } = await searchParams;
  const { season } = await getActiveSeasonContext();

  const [gameweeks, t, tTeam, tCommon, locale] = await Promise.all([
    getSeasonGameweeks(season.id),
    getTranslations("matches"),
    getTranslations("team"),
    getTranslations("common"),
    getLocale(),
  ]);

  const backLink = (
    <Link
      href="/more"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {tCommon("back")}
    </Link>
  );

  if (gameweeks.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {backLink}
        <h1 className="mt-3 font-heading text-2xl">{t("title")}</h1>
        <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <CalendarOff className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("noGameweeks")}</p>
        </div>
      </main>
    );
  }

  const now = new Date();
  const defaultGw =
    gameweeks.find((g) => g.deadline > now) ?? gameweeks.at(-1)!;
  const requested = Number(gw);
  const selected =
    gameweeks.find((g) => g.number === requested) ?? defaultGw;

  const fixtures = await getFixturesForGameweek(selected.id);

  const index = gameweeks.findIndex((g) => g.id === selected.id);
  const prev = index > 0 ? gameweeks[index - 1].number : null;
  const next = index < gameweeks.length - 1 ? gameweeks[index + 1].number : null;

  const gameweekStatus = effectiveGameweekStatus(selected, now);
  const statusLabel =
    gameweekStatus === "finished"
      ? tTeam("finished")
      : gameweekStatus === "locked"
        ? tTeam("live")
        : tTeam("upcoming");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {backLink}
      <h1 className="mt-3 mb-4 font-heading text-2xl">{t("title")}</h1>

      {/* Gameweek pager */}
      <div className="flex items-center gap-2">
        <PagerArrow toNumber={prev} direction="prev" label={t("prev")} />
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium">
            {tTeam("gameweek", { number: selected.number })}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {statusLabel}
            </span>
          </p>
        </div>
        <PagerArrow toNumber={next} direction="next" label={t("next")} />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {fixtures.map((fixture) => (
          <FixtureRow
            key={fixture.id}
            fixture={fixture}
            locale={locale}
            liveLabel={tTeam("live")}
          />
        ))}
        {fixtures.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noFixtures")}
          </li>
        )}
      </ul>
    </main>
  );
}

function PagerArrow({
  toNumber,
  direction,
  label,
}: {
  toNumber: number | null;
  direction: "prev" | "next";
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const className = cn(
    "flex size-10 items-center justify-center rounded-lg border border-border transition-colors",
    toNumber != null
      ? "cursor-pointer bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      : "pointer-events-none opacity-30"
  );
  if (toNumber == null) {
    return (
      <span className={className} aria-disabled>
        <Icon className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    <Link href={`/matches?gw=${toNumber}`} aria-label={label} className={className}>
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}
