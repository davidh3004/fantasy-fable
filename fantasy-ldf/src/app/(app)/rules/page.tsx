import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  ArrowLeftRight,
  CalendarClock,
  Star,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { scoringRules } from "@/db/schema";
import { getSessionUser } from "@/lib/supabase/user";
import { getActiveSeasonContext } from "@/lib/game/queries";
import { buildRuleLookup } from "@/lib/game/scoring";
import { formatMoney } from "@/lib/game/format";
import { POSITION_ORDER } from "@/lib/game/squad";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("more");
  return { title: t("rules") };
}

/**
 * Reading order for the scoring table. Anything the season defines that isn't
 * listed here still shows up, at the end — a rule the admin adds later should
 * never be silently missing from the page that claims to be the rules.
 */
const EVENT_ORDER = [
  "minutes_lt_60",
  "minutes_gte_60",
  "goal",
  "assist",
  "clean_sheet",
  "saves_per_3",
  "penalty_save",
  "penalty_miss",
  "goals_conceded_per_2",
  "yellow_card",
  "red_card",
  "own_goal",
];

export default async function RulesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { season, settings } = await getActiveSeasonContext();
  const [t, tPos, tEvents] = await Promise.all([
    getTranslations("rules"),
    getTranslations("positionsShort"),
    // The admin scoring editor already names every event in both languages.
    // Reusing those labels keeps the two screens from drifting apart.
    getTranslations("admin.scoring.events"),
  ]);

  const rules = await db
    .select({
      eventKey: scoringRules.eventKey,
      position: scoringRules.position,
      points: scoringRules.points,
    })
    .from(scoringRules)
    .where(eq(scoringRules.seasonId, season.id))
    .orderBy(asc(scoringRules.eventKey));

  const pointsFor = buildRuleLookup(rules);

  // Driven by what the season actually defines, not by a hardcoded list, so
  // the page can't promise points for an event that was never configured.
  const definedKeys = [...new Set(rules.map((r) => r.eventKey))];
  const eventKeys = [
    ...EVENT_ORDER.filter((key) => definedKeys.includes(key)),
    ...definedKeys.filter((key) => !EVENT_ORDER.includes(key)),
  ];

  const squadLines = [
    t("squad.size", {
      total: settings.squadSize,
      gk: settings.gkCount,
      def: settings.defCount,
      mid: settings.midCount,
      fwd: settings.fwdCount,
    }),
    t("squad.budget", { budget: formatMoney(settings.budget) }),
    t("squad.maxPerClub", { max: settings.maxPerClub }),
    t("squad.formation", {
      starters: settings.startingSize,
      def: settings.minDef,
      mid: settings.minMid,
      fwd: settings.minFwd,
    }),
    t("squad.bench", { bench: settings.squadSize - settings.startingSize }),
  ];

  const captainLines = [t("captain.double"), t("captain.vice"), t("captain.autoSubs")];

  const transferLines = [
    t("transfers.free", { count: settings.freeTransfersPerGw }),
    t("transfers.bank", { max: settings.maxBankedTransfers }),
    t("transfers.hit", { cost: settings.transferHitCost }),
    t("transfers.preSeason"),
  ];

  const gameweekLines = [
    t("gameweeks.deadline", { minutes: settings.deadlineOffsetMinutes }),
    t("gameweeks.locked"),
    t("gameweeks.finished"),
  ];

  const leagueLines = [t("leagues.overall"), t("leagues.private")];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{t("intro")}</p>

      <div className="mt-6 flex flex-col gap-4">
        <RuleSection Icon={Users} title={t("squad.title")} lines={squadLines} />

        {/* Scoring — the only part that needs a table rather than a list */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg">
            <Table2 className="size-4.5 text-primary" aria-hidden />
            {t("scoring.title")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("scoring.intro")}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 text-left font-medium">
                    {t("scoring.event")}
                  </th>
                  {POSITION_ORDER.map((position) => (
                    <th
                      key={position}
                      className="w-12 py-2 text-center font-medium"
                    >
                      {tPos(position)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventKeys.map((key) => (
                  <tr
                    key={key}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 pr-3">{tEvents(key)}</td>
                    {POSITION_ORDER.map((position) => {
                      const points = pointsFor(key, position);
                      return (
                        <td
                          key={position}
                          className={
                            points === 0
                              ? "py-2 text-center tabular-nums text-muted-foreground/50"
                              : "py-2 text-center font-medium tabular-nums"
                          }
                        >
                          {points > 0 ? `+${points}` : points}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Not in scoring_rules: bonus is entered per match by the
                    admin, so its value is fixed rather than configurable. */}
                <tr>
                  <td className="py-2 pr-3">{t("scoring.bonus")}</td>
                  <td
                    colSpan={POSITION_ORDER.length}
                    className="py-2 text-center font-medium tabular-nums"
                  >
                    +3 / +2 / +1
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {t("scoring.note")}
          </p>
        </section>

        <RuleSection
          Icon={Star}
          title={t("captain.title")}
          lines={captainLines}
        />
        <RuleSection
          Icon={ArrowLeftRight}
          title={t("transfers.title")}
          lines={transferLines}
        />
        <RuleSection
          Icon={CalendarClock}
          title={t("gameweeks.title")}
          lines={gameweekLines}
        />
        <RuleSection
          Icon={Trophy}
          title={t("leagues.title")}
          lines={leagueLines}
        />
      </div>
    </main>
  );
}

function RuleSection({
  Icon,
  title,
  lines,
}: {
  Icon: typeof Users;
  title: string;
  lines: string[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-heading text-lg">
        <Icon className="size-4.5 text-primary" aria-hidden />
        {title}
      </h2>
      <ul className="mt-2.5 flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5 text-sm">
            <span
              className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70"
              aria-hidden
            />
            <span className="text-muted-foreground">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
