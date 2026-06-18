"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  CirclePlus,
  Loader2,
  RotateCcw,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AuthAlert } from "@/components/auth/auth-alert";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import {
  POSITION_ORDER,
  autoPick,
  canAdd,
  positionQuota,
  squadCost,
  validateSquad,
  type Position,
  type SquadSettings,
} from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";

const POSITION_BADGE: Record<Position, string> = {
  GK: "bg-yellow-400/15 text-yellow-300",
  DEF: "bg-cyan-400/15 text-cyan-300",
  MID: "bg-emerald-400/15 text-emerald-300",
  FWD: "bg-rose-400/15 text-rose-300",
};

type Filter = "ALL" | Position | "PICKED";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type SquadPickerProps = {
  players: MarketPlayer[];
  settings: SquadSettings;
  initialSelectedIds?: string[];
  onSubmit: (playerIds: string[]) => void;
  onBack: () => void;
  isPending: boolean;
  errorMessage?: string;
};

export function SquadPicker({
  players,
  settings,
  initialSelectedIds,
  onSubmit,
  onBack,
  isPending,
  errorMessage,
}: SquadPickerProps) {
  const t = useTranslations("onboarding");
  const tPos = useTranslations("positionsShort");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds ?? []
  );
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const selected = useMemo(
    () => selectedIds.map((id) => playerById.get(id)!),
    [selectedIds, playerById]
  );

  const quota = positionQuota(settings);
  const remaining = settings.budget - squadCost(selected);
  const isValid = validateSquad(selected, settings) === null;

  const visiblePlayers = useMemo(() => {
    const query = normalize(search.trim());
    return players.filter((p) => {
      if (filter === "PICKED") {
        if (!selectedIds.includes(p.id)) return false;
      } else if (filter !== "ALL" && p.position !== filter) {
        return false;
      }
      if (!query) return true;
      return normalize(
        `${p.firstName} ${p.lastName} ${p.clubName} ${p.clubShortName}`
      ).includes(query);
    });
  }, [players, filter, search, selectedIds]);

  function toggle(player: MarketPlayer) {
    setSelectedIds((ids) => {
      if (ids.includes(player.id)) return ids.filter((id) => id !== player.id);
      const current = ids.map((id) => playerById.get(id)!);
      if (canAdd(current, player, settings) !== null) return ids;
      return [...ids, player.id];
    });
  }

  function handleAutoPick() {
    const picked = autoPick(players, settings);
    if (picked.length > 0) setSelectedIds(picked.map((p) => p.id));
  }

  const countsByPos = POSITION_ORDER.map((pos) => ({
    pos,
    count: selected.filter((p) => p.position === pos).length,
    quota: quota[pos],
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky status header */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("budgetRemaining")}
            </p>
            <p className="font-heading text-2xl tabular-nums text-emerald-300">
              {formatMoney(remaining)}
            </p>
          </div>
          <div className="flex-1 max-w-xs">
            <p className="mb-1.5 text-right text-sm tabular-nums text-muted-foreground">
              {t("selectedCount", {
                count: selected.length,
                total: settings.squadSize,
              })}
            </p>
            <Progress
              value={(selected.length / settings.squadSize) * 100}
              className="h-2"
            />
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {countsByPos.map(({ pos, count, quota: posQuota }) => (
            <span
              key={pos}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                count === posQuota
                  ? "bg-emerald-400/15 text-emerald-300"
                  : POSITION_BADGE[pos]
              )}
            >
              {tPos(pos)} {count}/{posQuota}
            </span>
          ))}
        </div>
      </div>

      {errorMessage && <AuthAlert variant="error" message={errorMessage} />}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Selected squad board — desktop only; mobile uses the "picked" filter */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            {POSITION_ORDER.map((pos) => {
              const inPos = selected.filter((p) => p.position === pos);
              return (
                <div key={pos}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tPos(pos)}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {Array.from({ length: quota[pos] }).map((_, i) => {
                      const player = inPos[i];
                      return player ? (
                        <div
                          key={player.id}
                          className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-sm"
                        >
                          <span className="flex-1 truncate">
                            {player.firstName} {player.lastName}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatMoney(player.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggle(player)}
                            aria-label={t("remove", {
                              name: `${player.firstName} ${player.lastName}`,
                            })}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={`empty-${pos}-${i}`}
                          className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground/50"
                        >
                          {t("emptySlot")}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Market */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="h-11 pl-9"
              aria-label={t("search")}
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist">
            {(["ALL", ...POSITION_ORDER, "PICKED"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "ALL"
                  ? t("filterAll")
                  : f === "PICKED"
                    ? `${t("filterPicked")} (${selected.length})`
                    : tPos(f)}
              </button>
            ))}
          </div>

          <ul className="flex flex-col gap-1.5">
            {visiblePlayers.map((player) => {
              const isSelected = selectedIds.includes(player.id);
              const block = isSelected
                ? null
                : canAdd(selected, player, settings);
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => toggle(player)}
                    disabled={!isSelected && block !== null}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50",
                      !isSelected &&
                        block !== null &&
                        "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-11 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold",
                        POSITION_BADGE[player.position]
                      )}
                    >
                      {tPos(player.position)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {player.firstName} {player.lastName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {player.clubName}
                      </span>
                    </span>
                    <span className="tabular-nums text-sm font-semibold">
                      {formatMoney(player.price)}
                    </span>
                    {isSelected ? (
                      <CircleCheck
                        className="size-5 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : (
                      <CirclePlus
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
            {visiblePlayers.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="h-11 cursor-pointer"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoPick}
            className="h-11 cursor-pointer"
          >
            <Shuffle className="size-4" aria-hidden />
            {t("autoPick")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={selected.length === 0}
            className="h-11 cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("reset")}
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(selectedIds)}
            disabled={!isValid || isPending}
            className="h-11 flex-1 cursor-pointer font-semibold sm:max-w-xs sm:ml-auto"
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
