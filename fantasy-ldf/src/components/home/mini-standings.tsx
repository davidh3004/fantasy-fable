import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { MovementArrow } from "@/components/home/gameweek-hero";
import { cn } from "@/lib/utils";
import type { StandingRow } from "@/lib/game/leagues";

type MiniStandingsProps = {
  rows: StandingRow[];
  myRank: number | null;
  /** How many rows to show before appending your own. */
  limit?: number;
};

export async function MiniStandings({
  rows,
  myRank,
  limit = 5,
}: MiniStandingsProps) {
  const t = await getTranslations("home");

  const top = rows.slice(0, limit);
  // Append your row when you're outside the visible top, so the card always
  // answers "where am I" without needing the full table.
  const me = rows.find((r) => r.isMe);
  const visible = me && !top.some((r) => r.isMe) ? [...top, me] : top;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base">
          <Trophy className="size-4 text-primary" aria-hidden />
          {t("league.title")}
        </h2>
        <Link
          href="/leagues"
          className="shrink-0 text-xs text-primary transition-colors hover:underline"
        >
          {t("league.viewAll")}
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("league.empty")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {visible.map((row) => (
              <li key={row.fantasyTeamId}>
                <Link
                  href={`/managers/${row.fantasyTeamId}?from=%2Fleagues`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent",
                    row.isMe && "bg-primary/10"
                  )}
                >
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {row.teamName}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {row.managerName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.totalPoints}
                  </span>
                  <span className="flex w-6 shrink-0 justify-end">
                    <MovementArrow movement={row.movement} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {myRank != null && (
            <p className="text-center text-xs text-muted-foreground">
              {t("league.yourPosition", { rank: myRank })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
