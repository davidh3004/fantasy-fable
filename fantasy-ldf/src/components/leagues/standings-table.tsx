"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { StandingRow } from "@/lib/game/leagues";

export function StandingsTable({
  rows,
  backHref,
}: {
  rows: StandingRow[];
  backHref: string;
}) {
  const t = useTranslations("leagues");
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  function open(teamId: string) {
    router.push(`/managers/${teamId}?from=${encodeURIComponent(backHref)}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse bg-card text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">{t("rank")}</th>
            <th className="px-3 py-2.5 font-medium">{t("team")}</th>
            <th className="px-2 py-2.5 text-right font-medium">{t("gw")}</th>
            <th className="px-3 py-2.5 text-right font-medium">{t("total")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.fantasyTeamId}
              tabIndex={0}
              role="link"
              onClick={() => open(row.fantasyTeamId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(row.fantasyTeamId);
                }
              }}
              className={cn(
                "cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                row.isMe && "bg-primary/10 hover:bg-primary/15"
              )}
            >
              <td className="px-3 py-2.5 font-semibold tabular-nums text-muted-foreground">
                {row.rank}
              </td>
              <td className="px-3 py-2.5">
                <span className="block max-w-[42vw] truncate font-medium sm:max-w-xs">
                  {row.teamName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.managerName}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                {row.gwPoints ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-right font-heading tabular-nums">
                {row.totalPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
