"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
import { PlayerAvatar } from "@/components/shared/player-avatar";
import {
  POSITION_BADGE,
  PositionBadge,
} from "@/components/shared/position-badge";
import { RangeSlider } from "@/components/ui/range-slider";
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

type Filter = "ALL" | Position | "PICKED";

const SELECT_CLASS =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

/** "Any price" sentinel — an empty select value keeps the option list simple. */
const ANY = "";

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
  const [clubId, setClubId] = useState<string>(ANY);

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const selected = useMemo(
    () => selectedIds.map((id) => playerById.get(id)!),
    [selectedIds, playerById]
  );

  // Clubs actually represented in the market, alphabetised.
  const clubOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of players) byId.set(p.clubId, p.clubName);
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [players]);

  // The real price spread, rounded out to whole dollars so the slider ends
  // land on clean numbers and always enclose every player.
  const priceBounds = useMemo((): [number, number] => {
    if (players.length === 0) return [0, 0];
    let low = Infinity;
    let high = -Infinity;
    for (const p of players) {
      if (p.price < low) low = p.price;
      if (p.price > high) high = p.price;
    }
    return [Math.floor(low / 10) * 10, Math.ceil(high / 10) * 10];
  }, [players]);

  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  // Null until touched, so a market that loads later still gets full bounds.
  const activeRange = priceRange ?? priceBounds;
  const hasFilters =
    filter !== "ALL" ||
    clubId !== ANY ||
    search.trim() !== "" ||
    activeRange[0] > priceBounds[0] ||
    activeRange[1] < priceBounds[1];

  function clearFilters() {
    setFilter("ALL");
    setClubId(ANY);
    setSearch("");
    setPriceRange(null);
  }

  const quota = positionQuota(settings);
  const remaining = settings.budget - squadCost(selected);
  const isValid = validateSquad(selected, settings) === null;

  const visiblePlayers = useMemo(() => {
    const query = normalize(search.trim());
    const [low, high] = activeRange;
    return players.filter((p) => {
      if (filter === "PICKED") {
        if (!selectedIds.includes(p.id)) return false;
      } else if (filter !== "ALL" && p.position !== filter) {
        return false;
      }
      if (clubId !== ANY && p.clubId !== clubId) return false;
      if (p.price < low || p.price > high) return false;
      if (!query) return true;
      return normalize(
        `${p.firstName} ${p.lastName} ${p.clubName} ${p.clubShortName}`
      ).includes(query);
    });
  }, [players, filter, search, selectedIds, clubId, activeRange]);

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
            {/* keyed so the figure pops each time the budget changes */}
            <p
              key={remaining}
              className={cn(
                "animate-pop-in font-heading text-2xl tabular-nums",
                remaining < 0 ? "text-cta" : "text-emerald-300"
              )}
            >
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
        {/* One tag per position, splitting the full width evenly so the row
            reads as a single status bar rather than a ragged pill cluster. */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {countsByPos.map(({ pos, count, quota: posQuota }) => (
            <span
              key={pos}
              className={cn(
                "rounded-md px-2 py-1 text-center text-xs font-medium tabular-nums transition-colors",
                // The nudge fires the moment a position line fills up.
                count === posQuota
                  ? "animate-nudge bg-emerald-400/15 text-emerald-300"
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

          {/* Club and position share a line; the price range gets its own
              below, where a slider needs the full width to be draggable. */}
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className={SELECT_CLASS}
                aria-label={t("filterClub")}
              >
                <option value={ANY}>{t("allClubs")}</option>
                {clubOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                className={SELECT_CLASS}
                aria-label={t("filterPosition")}
              >
                <option value="ALL">{t("filterAll")}</option>
                {POSITION_ORDER.map((pos) => (
                  <option key={pos} value={pos}>
                    {tPos(pos)}
                  </option>
                ))}
                <option value="PICKED">
                  {t("filterPicked")} ({selected.length})
                </option>
              </select>
            </div>

            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("priceRange")}
                </span>
                <span className="tabular-nums text-xs font-semibold">
                  {formatMoney(activeRange[0])} – {formatMoney(activeRange[1])}
                </span>
              </div>
              <RangeSlider
                value={activeRange}
                onValueChange={setPriceRange}
                min={priceBounds[0]}
                max={priceBounds[1]}
                // Prices are stored in tenths, so this is a $0.1 increment.
                step={1}
                thumbLabel={(index) =>
                  index === 0 ? t("filterMinPrice") : t("filterMaxPrice")
                }
                formatValue={formatMoney}
              />
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {visiblePlayers.map((player, index) => {
              const isSelected = selectedIds.includes(player.id);
              const block = isSelected
                ? null
                : canAdd(selected, player, settings);
              return (
                <li
                  key={player.id}
                  // Only the first rows stagger in — the market can hold
                  // hundreds of players and animating them all would jank.
                  className={index < 12 ? "animate-fade-up" : undefined}
                  style={index < 12 ? ({ "--i": index } as CSSProperties) : undefined}
                >
                  <button
                    type="button"
                    onClick={() => toggle(player)}
                    disabled={!isSelected && block !== null}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50 hover:-translate-y-px",
                      !isSelected &&
                        block !== null &&
                        "cursor-not-allowed opacity-40"
                    )}
                  >
                    <PlayerAvatar photoUrl={player.photoUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {player.firstName} {player.lastName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {player.clubName}
                      </span>
                    </span>
                    <PositionBadge position={player.position} />
                    <span className="w-14 shrink-0 text-right tabular-nums text-sm font-semibold">
                      {formatMoney(player.price)}
                    </span>
                    {isSelected ? (
                      <CircleCheck
                        className="animate-pop-in size-5 shrink-0 text-primary"
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
              <li className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t("noResults")}
                {hasFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    className="h-9 cursor-pointer"
                  >
                    {t("clearFilters")}
                  </Button>
                )}
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {/* Two rows: the squad-shaping tools sit together, and the
            navigation pair (leave / continue) reads left-to-right below. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-around gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleAutoPick}
              className="h-11 flex-1 cursor-pointer"
            >
              <Shuffle className="size-4" aria-hidden />
              {t("autoPick")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedIds([])}
              disabled={selected.length === 0}
              className="h-11 flex-1 cursor-pointer"
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("reset")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="h-11 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("back")}
            </Button>
            <Button
              type="button"
              onClick={() => onSubmit(selectedIds)}
              disabled={!isValid || isPending}
              className={cn(
                "h-11 flex-1 cursor-pointer font-semibold transition-transform active:scale-[0.98]",
                // Pulses once the squad is legal, so "you can continue" is obvious.
                isValid && !isPending && "animate-ready-glow"
              )}
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {t("confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
