"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  saveMatchResult,
  type PlayerStatInput,
} from "@/app/(app)/admin/actions";
import type { Position } from "@/lib/game/squad";

export type ResultPlayer = {
  id: string;
  name: string;
  position: Position;
  clubId: string;
};

export type ExistingStat = PlayerStatInput & { bonusPoints: number };

type ResultEditorProps = {
  fixtureId: string;
  homeName: string;
  awayName: string;
  homeClubId: string;
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  players: ResultPlayer[];
  existingStats: ExistingStat[];
};

const STAT_COLUMNS = [
  "minutes",
  "goals",
  "assists",
  "saves",
  "penaltiesSaved",
  "penaltiesMissed",
  "yellowCards",
  "redCards",
  "ownGoals",
] as const;

type StatKey = (typeof STAT_COLUMNS)[number];

const emptyLine = (playerId: string): PlayerStatInput => ({
  playerId,
  minutes: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  penaltiesSaved: 0,
  penaltiesMissed: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
});

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export function ResultEditor({
  fixtureId,
  homeName,
  awayName,
  homeClubId,
  initialHomeScore,
  initialAwayScore,
  players,
  existingStats,
}: ResultEditorProps) {
  const t = useTranslations("admin.result");
  const tPos = useTranslations("positionsShort");
  const router = useRouter();

  const [homeScore, setHomeScore] = useState(initialHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState(initialAwayScore ?? 0);
  const [lines, setLines] = useState<Record<string, PlayerStatInput>>(() => {
    const byId: Record<string, PlayerStatInput> = {};
    for (const player of players) {
      const existing = existingStats.find((s) => s.playerId === player.id);
      byId[player.id] = existing
        ? { ...emptyLine(player.id), ...existing }
        : emptyLine(player.id);
    }
    return byId;
  });
  const initialBonus = useMemo(() => {
    const sorted = [...existingStats].sort(
      (a, b) => b.bonusPoints - a.bonusPoints
    );
    return {
      first: sorted.find((s) => s.bonusPoints === 3)?.playerId ?? "",
      second: sorted.find((s) => s.bonusPoints === 2)?.playerId ?? "",
      third: sorted.find((s) => s.bonusPoints === 1)?.playerId ?? "",
    };
  }, [existingStats]);
  const [bonus, setBonus] = useState(initialBonus);
  const [isPending, startTransition] = useTransition();

  function setStat(playerId: string, key: StatKey, raw: string) {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    setLines((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: value },
    }));
  }

  const playedPlayers = players.filter((p) => lines[p.id].minutes > 0);

  function handleSave() {
    startTransition(async () => {
      const result = await saveMatchResult({
        fixtureId,
        homeScore,
        awayScore,
        stats: Object.values(lines),
        bonus: {
          first: bonus.first || undefined,
          second: bonus.second || undefined,
          third: bonus.third || undefined,
        },
      });
      if (result.error) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  function clubTable(clubId: string, clubName: string) {
    const clubPlayers = players.filter((p) => p.clubId === clubId);
    return (
      <section>
        <h2 className="mb-2 font-heading text-base">{clubName}</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[680px] border-collapse bg-card text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("player")}</th>
                {STAT_COLUMNS.map((col) => (
                  <th key={col} className="px-1 py-2 text-center font-medium">
                    {t(`cols.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clubPlayers.map((player) => (
                <tr
                  key={player.id}
                  className={cn(
                    "border-b border-border/50 last:border-0",
                    lines[player.id].minutes > 0 && "bg-primary/5"
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className="block max-w-36 truncate font-medium">
                      {player.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {tPos(player.position)}
                    </span>
                  </td>
                  {STAT_COLUMNS.map((col) => (
                    <td key={col} className="px-1 py-1.5 text-center">
                      <Input
                        type="number"
                        min="0"
                        max={col === "minutes" ? 120 : 9}
                        value={lines[player.id][col] || ""}
                        placeholder="0"
                        onChange={(e) => setStat(player.id, col, e.target.value)}
                        aria-label={`${player.name} ${t(`cols.${col}`)}`}
                        className="mx-auto h-8 w-12 px-1 text-center tabular-nums"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Score */}
      <section className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
        <span className="min-w-0 flex-1 truncate text-right font-medium">
          {homeName}
        </span>
        <Input
          type="number"
          min="0"
          max="20"
          value={homeScore}
          onChange={(e) => setHomeScore(Math.max(0, Number(e.target.value) || 0))}
          aria-label={t("homeScore")}
          className="h-12 w-14 text-center font-heading text-xl tabular-nums"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          min="0"
          max="20"
          value={awayScore}
          onChange={(e) => setAwayScore(Math.max(0, Number(e.target.value) || 0))}
          aria-label={t("awayScore")}
          className="h-12 w-14 text-center font-heading text-xl tabular-nums"
        />
        <span className="min-w-0 flex-1 truncate font-medium">{awayName}</span>
      </section>

      <p className="text-xs text-muted-foreground">{t("autoHint")}</p>

      {clubTable(homeClubId, homeName)}
      {clubTable(
        players.find((p) => p.clubId !== homeClubId)?.clubId ?? "",
        awayName
      )}

      {/* Bonus picks */}
      <section className="rounded-xl border border-border bg-card p-3.5">
        <h2 className="mb-2.5 font-heading text-base">{t("bonusTitle")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("bonusHint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["first", "second", "third"] as const).map((slot, index) => (
            <div key={slot} className="flex flex-col gap-1.5">
              <label
                htmlFor={`bonus-${slot}`}
                className="text-xs font-medium text-muted-foreground"
              >
                {t("bonusSlot", { points: 3 - index })}
              </label>
              <select
                id={`bonus-${slot}`}
                value={bonus[slot]}
                onChange={(e) =>
                  setBonus((prev) => ({ ...prev, [slot]: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">{t("bonusNone")}</option>
                {playedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={isPending}
        className="h-12 cursor-pointer font-semibold"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {t("save")}
      </Button>
    </div>
  );
}
