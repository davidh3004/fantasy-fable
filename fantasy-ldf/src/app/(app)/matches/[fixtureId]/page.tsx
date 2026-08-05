import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { ClubCrest } from "@/components/shared/club-badge";
import { cn } from "@/lib/utils";
import { formatKickoff } from "@/lib/game/format";
import {
  getActiveSeasonContext,
  getFixtureById,
  getFixtureStats,
  type FixtureStatRow,
} from "@/lib/game/queries";
import { effectiveFixtureStatus } from "@/lib/game/status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("matches") };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { fixtureId } = await params;
  await getActiveSeasonContext(); // ensures season exists / cache warm

  const [fixture, t, tTeam, tPos, locale] = await Promise.all([
    getFixtureById(fixtureId),
    getTranslations("matches"),
    getTranslations("team"),
    getTranslations("positionsShort"),
    getLocale(),
  ]);
  if (!fixture) notFound();

  const played = fixture.homeScore != null && fixture.awayScore != null;
  const stats = played ? await getFixtureStats(fixtureId) : [];
  const homeStats = stats.filter((s) => s.clubId === fixture.homeClubId);
  const awayStats = stats.filter((s) => s.clubId === fixture.awayClubId);

  const fixtureStatus = effectiveFixtureStatus(fixture);
  const statusLabel =
    fixtureStatus === "finished"
      ? tTeam("finished")
      : fixtureStatus === "live"
        ? tTeam("live")
        : tTeam("upcoming");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={`/matches?gw=${fixture.gameweekNumber}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      {/* Scoreboard */}
      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        <p className="text-center text-xs text-muted-foreground">
          {tTeam("gameweek", { number: fixture.gameweekNumber })}
          {" · "}
          <span className="capitalize">{statusLabel}</span>
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <ClubCrest
              shortName={fixture.homeShort}
              name={fixture.homeName}
              color={fixture.homeColor}
              badgeUrl={fixture.homeBadgeUrl}
              className="size-12 text-sm"
            />
            <span className="text-center text-sm font-medium">
              {fixture.homeName}
            </span>
          </div>
          <div className="shrink-0 text-center">
            {played ? (
              <p className="font-heading text-3xl tabular-nums">
                {fixture.homeScore} - {fixture.awayScore}
              </p>
            ) : (
              <p className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-5" aria-hidden />
                <span className="capitalize">
                  {formatKickoff(fixture.kickoff, locale)}
                </span>
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <ClubCrest
              shortName={fixture.awayShort}
              name={fixture.awayName}
              color={fixture.awayColor}
              badgeUrl={fixture.awayBadgeUrl}
              className="size-12 text-sm"
            />
            <span className="text-center text-sm font-medium">
              {fixture.awayName}
            </span>
          </div>
        </div>
      </section>

      {/* Player stats */}
      {played ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ClubStats
            title={fixture.homeName}
            rows={homeStats}
            tPos={tPos}
            emptyLabel={t("noStats")}
          />
          <ClubStats
            title={fixture.awayName}
            rows={awayStats}
            tPos={tPos}
            emptyLabel={t("noStats")}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("notPlayed")}
        </div>
      )}
    </main>
  );
}

function EventChip({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      {label}
    </span>
  );
}

function StatChips({ row }: { row: FixtureStatRow }) {
  const chips: Array<{ label: string; title: string }> = [];
  if (row.goals > 0)
    chips.push({ label: `${row.goals} G`, title: `Goles: ${row.goals}` });
  if (row.assists > 0)
    chips.push({ label: `${row.assists} A`, title: `Asistencias: ${row.assists}` });
  if (row.cleanSheet) chips.push({ label: "CS", title: "Portería a cero" });
  if (row.saves > 0)
    chips.push({ label: `${row.saves} ATJ`, title: `Atajadas: ${row.saves}` });
  if (row.penaltiesSaved > 0)
    chips.push({ label: `${row.penaltiesSaved} PA`, title: "Penales atajados" });
  if (row.penaltiesMissed > 0)
    chips.push({ label: `${row.penaltiesMissed} PF`, title: "Penales fallados" });
  if (row.ownGoals > 0)
    chips.push({ label: `${row.ownGoals} AG`, title: "Autogoles" });
  if (row.yellowCards > 0) chips.push({ label: "TA", title: "Tarjeta amarilla" });
  if (row.redCards > 0) chips.push({ label: "TR", title: "Tarjeta roja" });
  if (row.bonusPoints > 0)
    chips.push({ label: `+${row.bonusPoints}`, title: "Puntos de bonificación" });

  if (chips.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <EventChip key={i} label={c.label} title={c.title} />
      ))}
    </span>
  );
}

function ClubStats({
  title,
  rows,
  tPos,
  emptyLabel,
}: {
  title: string;
  rows: FixtureStatRow[];
  tPos: (key: string) => string;
  emptyLabel: string;
}) {
  return (
    <section>
      <h2 className="mb-2 font-heading text-base">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {rows.map((row) => (
            <li
              key={row.playerId}
              className="flex items-start gap-2 border-b border-border/50 bg-card px-3 py-2 last:border-0"
            >
              <span
                className={cn(
                  "mt-0.5 w-9 shrink-0 rounded-md px-1 py-0.5 text-center text-[10px] font-semibold",
                  row.position === "GK" && "bg-yellow-400/15 text-yellow-300",
                  row.position === "DEF" && "bg-cyan-400/15 text-cyan-300",
                  row.position === "MID" && "bg-emerald-400/15 text-emerald-300",
                  row.position === "FWD" && "bg-rose-400/15 text-rose-300"
                )}
              >
                {tPos(row.position)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {row.firstName} {row.lastName}
                </span>
                <StatChips row={row} />
              </span>
              <span className="shrink-0 font-heading text-sm tabular-nums">
                {row.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
