"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  CircleDot,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  reopenMatch,
  saveMatchProgress,
  type LiveStatLine,
} from "@/app/(app)/admin/actions";
import {
  buildRuleLookup,
  computePoints,
  type ScoringRuleRow,
} from "@/lib/game/scoring";
import {
  FULL_TIME_MINUTE,
  elapsedMinute,
  isOnPitch,
  minutesPlayed,
} from "@/lib/game/match-clock";
import { POSITION_ORDER, type Position } from "@/lib/game/squad";

export type ConsolePlayer = {
  id: string;
  name: string;
  position: Position;
  clubId: string;
};

type Tab = "lineups" | "live" | "all";

/** Counter stats a rapid action can bump. */
const ACTIONS = [
  { key: "goals", tone: "bg-emerald-500 text-white" },
  { key: "assists", tone: "bg-cyan-500 text-white" },
  { key: "saves", tone: "bg-sky-500 text-white" },
  { key: "yellowCards", tone: "bg-yellow-400 text-yellow-950" },
  { key: "redCards", tone: "bg-destructive text-white" },
  { key: "penaltiesSaved", tone: "bg-indigo-500 text-white" },
  { key: "penaltiesMissed", tone: "bg-orange-500 text-white" },
  { key: "ownGoals", tone: "bg-rose-600 text-white" },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

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

const emptyLine = (playerId: string): LiveStatLine => ({
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
  started: false,
  onMinute: null,
  offMinute: null,
});

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type MatchConsoleProps = {
  fixtureId: string;
  kickoff: string; // ISO
  isFinished: boolean;
  homeName: string;
  awayName: string;
  homeClubId: string;
  awayClubId: string;
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  players: ConsolePlayer[];
  existingStats: LiveStatLine[];
  existingBonus: { first: string; second: string; third: string };
  rules: ScoringRuleRow[];
  startingSize: number;
};

export function MatchConsole({
  fixtureId,
  kickoff,
  isFinished,
  homeName,
  awayName,
  homeClubId,
  awayClubId,
  initialHomeScore,
  initialAwayScore,
  players,
  existingStats,
  existingBonus,
  rules,
  startingSize,
}: MatchConsoleProps) {
  const t = useTranslations("admin.result");
  const tPos = useTranslations("positionsShort");
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(isFinished ? "all" : "lineups");
  const [homeScore, setHomeScore] = useState(initialHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState(initialAwayScore ?? 0);
  const [clock, setClock] = useState(() =>
    isFinished ? FULL_TIME_MINUTE : elapsedMinute(new Date(kickoff))
  );
  const [bonus, setBonus] = useState(existingBonus);
  const [armed, setArmed] = useState<ActionKey | null>(null);
  const [subOffId, setSubOffId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ playerId: string; key: ActionKey }>
  >([]);
  const [isPending, startTransition] = useTransition();

  const [lines, setLines] = useState<Record<string, LiveStatLine>>(() => {
    const byId: Record<string, LiveStatLine> = {};
    for (const player of players) {
      const existing = existingStats.find((s) => s.playerId === player.id);
      byId[player.id] = existing
        ? { ...emptyLine(player.id), ...existing }
        : emptyLine(player.id);
    }
    return byId;
  });

  const rule = useMemo(() => buildRuleLookup(rules), [rules]);
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  /** Live fantasy points for a player, exactly as the server will score it. */
  function pointsFor(player: ConsolePlayer): number {
    const line = lines[player.id];
    const minutes = minutesPlayed(line, clock);
    if (minutes <= 0) return 0;
    const conceded = player.clubId === homeClubId ? awayScore : homeScore;
    return computePoints(
      {
        minutes,
        goals: line.goals,
        assists: line.assists,
        saves: line.saves,
        penaltiesSaved: line.penaltiesSaved,
        penaltiesMissed: line.penaltiesMissed,
        goalsConceded: conceded,
        cleanSheet: conceded === 0 && minutes >= 60,
        yellowCards: line.yellowCards,
        redCards: line.redCards,
        ownGoals: line.ownGoals,
        bonusPoints:
          bonus.first === player.id
            ? 3
            : bonus.second === player.id
              ? 2
              : bonus.third === player.id
                ? 1
                : 0,
      },
      player.position,
      rule
    );
  }

  function patch(playerId: string, changes: Partial<LiveStatLine>) {
    setLines((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], ...changes },
    }));
  }

  function toggleStarter(playerId: string) {
    const line = lines[playerId];
    patch(playerId, {
      started: !line.started,
      onMinute: line.started ? null : 0,
      offMinute: null,
    });
  }

  /** Rapid action: an action is armed, then a player is tapped. */
  function applyAction(playerId: string) {
    if (!armed) return;
    patch(playerId, { [armed]: (lines[playerId][armed] as number) + 1 });
    setHistory((h) => [...h, { playerId, key: armed }]);
    // Keep the score in step when a goal is recorded.
    if (armed === "goals") {
      const player = playerById.get(playerId);
      if (player?.clubId === homeClubId) setHomeScore((s) => s + 1);
      else setAwayScore((s) => s + 1);
    }
    setArmed(null);
  }

  function undoLast() {
    const last = history.at(-1);
    if (!last) return;
    const current = lines[last.playerId][last.key] as number;
    patch(last.playerId, { [last.key]: Math.max(0, current - 1) });
    if (last.key === "goals") {
      const player = playerById.get(last.playerId);
      if (player?.clubId === homeClubId) setHomeScore((s) => Math.max(0, s - 1));
      else setAwayScore((s) => Math.max(0, s - 1));
    }
    setHistory((h) => h.slice(0, -1));
  }

  /** Substitution: the pending player comes off, the tapped one comes on. */
  function completeSub(incomingId: string) {
    if (!subOffId) return;
    patch(subOffId, { offMinute: clock });
    patch(incomingId, { started: false, onMinute: clock, offMinute: null });
    setSubOffId(null);
  }

  const clubPlayers = (clubId: string) =>
    players.filter((p) => p.clubId === clubId);

  const startersFor = (clubId: string) =>
    clubPlayers(clubId).filter((p) => lines[p.id].started);

  const onPitch = (clubId: string) =>
    clubPlayers(clubId).filter((p) => isOnPitch(lines[p.id], clock));

  const availableBench = (clubId: string) =>
    clubPlayers(clubId).filter(
      (p) => !isOnPitch(lines[p.id], clock) && lines[p.id].onMinute == null
    );

  function save(publish: boolean) {
    startTransition(async () => {
      const result = await saveMatchProgress({
        fixtureId,
        homeScore,
        awayScore,
        currentMinute: clock,
        lines: Object.values(lines),
        bonus: {
          first: bonus.first || undefined,
          second: bonus.second || undefined,
          third: bonus.third || undefined,
        },
        publish,
      });
      if (result.error) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(publish ? t("published") : t("saved"));
      setHistory([]);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      const result = await reopenMatch(fixtureId);
      if (result.error) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("reopened"));
      router.refresh();
    });
  }

  // ---------------------------------------------------------------- render

  const tabs: Tab[] = ["lineups", "live", "all"];

  return (
    <div className="flex flex-col gap-4">
      {/* Scoreboard */}
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

      {/* Match clock */}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="match-clock">{t("clock")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="match-clock"
              type="number"
              min="0"
              max={FULL_TIME_MINUTE}
              value={clock}
              onChange={(e) =>
                setClock(
                  Math.min(
                    Math.max(Number(e.target.value) || 0, 0),
                    FULL_TIME_MINUTE
                  )
                )
              }
              className="h-10 w-20 text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setClock(elapsedMinute(new Date(kickoff)))}
              className="h-10 cursor-pointer"
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("syncClock")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClock(FULL_TIME_MINUTE)}
              className="h-10 cursor-pointer"
            >
              {t("fullTime")}
            </Button>
          </div>
        </div>
        <p className="flex-1 text-xs text-muted-foreground">{t("clockHint")}</p>
      </section>

      {/* Tabs */}
      <div
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1"
        role="tablist"
      >
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-10 cursor-pointer rounded-lg text-sm font-semibold transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- Lineups */}
      {tab === "lineups" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { id: homeClubId, name: homeName },
            { id: awayClubId, name: awayName },
          ].map((club) => {
            const picked = startersFor(club.id).length;
            return (
              <section
                key={club.id}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-heading text-base">{club.name}</h2>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                      picked === startingSize
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {picked}/{startingSize}
                  </span>
                </div>
                {POSITION_ORDER.map((pos) => {
                  const group = clubPlayers(club.id).filter(
                    (p) => p.position === pos
                  );
                  if (group.length === 0) return null;
                  return (
                    <div key={pos} className="mb-2.5">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {tPos(pos)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => toggleStarter(player.id)}
                            aria-pressed={lines[player.id].started}
                            className={cn(
                              "cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                              lines[player.id].started
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {player.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
          <p className="text-xs text-muted-foreground lg:col-span-2">
            {t("lineupsHint")}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- Live */}
      {tab === "live" && (
        <div className="flex flex-col gap-4">
          {/* Rapid actions */}
          <section className="rounded-xl border border-border bg-card p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-base">{t("rapidTitle")}</h2>
              <Button
                type="button"
                variant="outline"
                onClick={undoLast}
                disabled={history.length === 0}
                className="h-9 cursor-pointer"
              >
                <Undo2 className="size-4" aria-hidden />
                {t("undo")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() =>
                    setArmed((a) => (a === action.key ? null : action.key))
                  }
                  aria-pressed={armed === action.key}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-all",
                    armed === action.key
                      ? `${action.tone} scale-105 ring-2 ring-foreground/30`
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`actions.${action.key}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {armed
                ? t("rapidArmed", { action: t(`actions.${armed}`) })
                : t("rapidHint")}
            </p>
          </section>

          {/* On-pitch columns */}
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { id: homeClubId, name: homeName },
              { id: awayClubId, name: awayName },
            ].map((club) => (
              <section
                key={club.id}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <h2 className="mb-2 font-heading text-base">{club.name}</h2>

                <ul className="flex flex-col gap-1">
                  {onPitch(club.id).map((player) => {
                    const line = lines[player.id];
                    return (
                      <li
                        key={player.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                          armed
                            ? "cursor-pointer border-primary/40 hover:bg-primary/10"
                            : "border-border"
                        )}
                        onClick={() => armed && applyAction(player.id)}
                      >
                        <span className="w-9 shrink-0 rounded bg-muted px-1 py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
                          {tPos(player.position)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {player.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {minutesPlayed(line, clock)}&apos;
                        </span>
                        <span className="w-8 shrink-0 text-right font-heading text-sm tabular-nums">
                          {pointsFor(player)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubOffId(
                              subOffId === player.id ? null : player.id
                            );
                          }}
                          aria-label={t("subOff")}
                          className={cn(
                            "cursor-pointer",
                            subOffId === player.id && "text-cta"
                          )}
                        >
                          <ArrowLeftRight className="size-4" aria-hidden />
                        </Button>
                      </li>
                    );
                  })}
                  {onPitch(club.id).length === 0 && (
                    <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("noStarters")}
                    </li>
                  )}
                </ul>

                {/* Bench — tapping brings a player on for the pending sub */}
                {subOffId && playerById.get(subOffId)?.clubId === club.id && (
                  <div className="mt-3 rounded-lg border border-cta/40 bg-cta/5 p-2.5">
                    <p className="mb-2 text-xs font-medium">
                      {t("subPrompt", {
                        name: playerById.get(subOffId)?.name ?? "",
                        minute: clock,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableBench(club.id).map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => completeSub(player.id)}
                          className="min-h-9 cursor-pointer rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:border-primary/50"
                        >
                          {player.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- All stats */}
      {tab === "all" && (
        <div className="flex flex-col gap-4">
          {[
            { id: homeClubId, name: homeName },
            { id: awayClubId, name: awayName },
          ].map((club) => (
            <section key={club.id}>
              <h2 className="mb-2 font-heading text-base">{club.name}</h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] border-collapse bg-card text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t("player")}</th>
                      {STAT_COLUMNS.map((col) => (
                        <th
                          key={col}
                          className="px-1 py-2 text-center font-medium"
                        >
                          {t(`cols.${col}`)}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-medium">
                        {t("cols.points")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubPlayers(club.id).map((player) => {
                      const line = lines[player.id];
                      const minutes = minutesPlayed(line, clock);
                      return (
                        <tr
                          key={player.id}
                          className={cn(
                            "border-b border-border/50 last:border-0",
                            minutes > 0 && "bg-primary/5"
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
                              {col === "minutes" ? (
                                // Derived from the lineup + subs, not typed.
                                <span className="inline-block w-12 text-center text-xs tabular-nums text-muted-foreground">
                                  {minutes}
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  max="9"
                                  value={(line[col] as number) || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    patch(player.id, {
                                      [col]: Math.max(
                                        0,
                                        Math.floor(Number(e.target.value) || 0)
                                      ),
                                    })
                                  }
                                  aria-label={`${player.name} ${t(`cols.${col}`)}`}
                                  className="mx-auto h-8 w-12 px-1 text-center tabular-nums"
                                />
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-heading tabular-nums">
                            {pointsFor(player)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
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
                {players
                  .filter((p) => minutesPlayed(lines[p.id], clock) > 0)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 z-20 flex flex-wrap gap-2 rounded-xl border border-border bg-background/95 p-2.5 backdrop-blur">
        <Button
          type="button"
          variant="outline"
          onClick={() => save(false)}
          disabled={isPending}
          className="h-12 flex-1 cursor-pointer font-semibold"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {t("saveProgress")}
        </Button>

        {isFinished ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleReopen}
            disabled={isPending}
            className="h-12 flex-1 cursor-pointer font-semibold"
          >
            <CircleDot className="size-4" aria-hidden />
            {t("reopen")}
          </Button>
        ) : (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                disabled={isPending}
                className="h-12 flex-1 cursor-pointer font-semibold"
              >
                <Send className="size-4" aria-hidden />
                {t("publish")}
              </Button>
            }
            title={t("publishConfirmTitle")}
            description={t("publishConfirmBody")}
            confirmLabel={t("publish")}
            cancelLabel={t("cancel")}
            destructive={false}
            onConfirm={() => save(true)}
          />
        )}
      </div>
    </div>
  );
}
