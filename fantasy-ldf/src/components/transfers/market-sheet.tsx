"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Info, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomSheetContent } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ClubBadge } from "@/components/pitch/player-chip";
import { cn } from "@/lib/utils";
import { PlayerModal } from "@/components/team/player-modal";
import type { ScoringRuleRow } from "@/lib/game/scoring";
import type { GameweekStatLines } from "@/lib/game/queries";
import { makeHistoryBuilder } from "@/lib/game/player-history";
import { formatMoney } from "@/lib/game/format";
import type { MarketPlayer } from "@/lib/game/queries";
import type { Position } from "@/lib/game/squad";
import type { TransferBatchError } from "@/lib/game/transfers";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type MarketCandidate = {
  player: MarketPlayer;
  block: TransferBatchError | null;
};

type SortKey = "price_desc" | "price_asc" | "name";

type MarketSheetProps = {
  /** Per-gameweek stat lines, so the info modal can step through the season. */
  statsByGameweek?: GameweekStatLines[];
  rules?: ScoringRuleRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position | null;
  /** Player being transferred out. */
  outgoing: MarketPlayer | null;
  /** Max spend for this transfer: bank preview + outgoing price (tenths). */
  available: number;
  candidates: MarketCandidate[];
  fixtureLabel: (player: MarketPlayer) => string | undefined;
  onPick: (playerId: string) => void;
};

const selectClass =
  "h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export function MarketSheet({
  open,
  onOpenChange,
  position,
  outgoing,
  available,
  candidates,
  fixtureLabel,
  onPick,
  statsByGameweek,
  rules,
}: MarketSheetProps) {
  const t = useTranslations("transfers.market");
  const tPos = useTranslations("positions");
  const [search, setSearch] = useState("");
  const [infoId, setInfoId] = useState<string | null>(null);

  const buildHistory = useMemo(() => makeHistoryBuilder(rules), [rules]);
  const infoPlayer = infoId
    ? (candidates.find((c) => c.player.id === infoId)?.player ?? null)
    : null;

  function historyFor(player: MarketPlayer) {
    if (!buildHistory || !statsByGameweek) return undefined;
    return buildHistory(player.id, player.position, statsByGameweek);
  }
  const [clubId, setClubId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("price_desc");
  const [onlyAffordable, setOnlyAffordable] = useState(false);

  const clubs = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const { player } of candidates) {
      if (!seen.has(player.clubId)) {
        seen.set(player.clubId, { id: player.clubId, name: player.clubName });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates]);

  const visible = useMemo(() => {
    const query = normalize(search.trim());
    const filtered = candidates.filter(({ player, block }) => {
      if (clubId !== "all" && player.clubId !== clubId) return false;
      if (onlyAffordable && block !== null) return false;
      if (!query) return true;
      return normalize(
        `${player.firstName} ${player.lastName} ${player.clubName} ${player.clubShortName}`
      ).includes(query);
    });
    return filtered.sort((a, b) => {
      if (sort === "price_desc") return b.player.price - a.player.price;
      if (sort === "price_asc") return a.player.price - b.player.price;
      return a.player.lastName.localeCompare(b.player.lastName);
    });
  }, [candidates, search, clubId, sort, onlyAffordable]);

  function resetFilters() {
    setSearch("");
    setClubId("all");
    setSort("price_desc");
    setOnlyAffordable(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetFilters();
        onOpenChange(next);
      }}
    >
      <BottomSheetContent className="flex max-h-[85dvh] flex-col gap-0">
        <div className="flex flex-col gap-3 p-4 pb-3">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {position ? t("title", { position: tPos(position) }) : ""}
            </DialogTitle>
          </DialogHeader>

          {/* Outgoing player + available budget for this transfer */}
          {outgoing && (
            <div className="flex items-center gap-2.5 rounded-xl border border-cta/40 bg-cta/10 px-3 py-2.5">
              <ClubBadge player={outgoing} className="size-7 text-[8px]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("out")}
                </span>
                <span className="block truncate text-sm font-medium">
                  {outgoing.lastName}{" "}
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(outgoing.price)}
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-cta" aria-hidden />
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("available")}
                </span>
                <span className="block font-heading text-base tabular-nums text-emerald-300">
                  {formatMoney(available)}
                </span>
              </span>
            </div>
          )}

          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
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

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              aria-label={t("filterClub")}
              className={selectClass}
            >
              <option value="all">{t("allClubs")}</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={t("sort")}
              className={selectClass}
            >
              <option value="price_desc">{t("sortPriceDesc")}</option>
              <option value="price_asc">{t("sortPriceAsc")}</option>
              <option value="name">{t("sortName")}</option>
            </select>
            <button
              type="button"
              onClick={() => setOnlyAffordable((v) => !v)}
              aria-pressed={onlyAffordable}
              className={cn(
                "h-9 shrink-0 cursor-pointer rounded-lg border px-2.5 text-xs font-medium transition-colors",
                onlyAffordable
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {t("onlyAffordable")}
            </button>
          </div>
        </div>

        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-4">
          {visible.map(({ player, block }) => (
            <li key={player.id} className="relative">
              <button
                type="button"
                disabled={block !== null}
                onClick={() => onPick(player.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border bg-card py-2.5 pr-11 pl-3 text-left transition-colors",
                  block === null
                    ? "cursor-pointer hover:border-primary/50"
                    : "cursor-not-allowed opacity-40"
                )}
              >
                <ClubBadge player={player} className="size-8 text-[9px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {player.firstName} {player.lastName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {player.clubName}
                    {fixtureLabel(player) ? ` · ${fixtureLabel(player)}` : ""}
                  </span>
                </span>
                {block !== null && (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(`blocked.${block === "budget" ? "budget" : "club"}`)}
                  </span>
                )}
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(player.price)}
                </span>
              </button>
              {/* Separate from the row so inspecting a player never picks
                  them — and it stays reachable when the pick is blocked. */}
              <button
                type="button"
                onClick={() => setInfoId(player.id)}
                aria-label={t("info", {
                  name: `${player.firstName} ${player.lastName}`,
                })}
                className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Info className="size-4" aria-hidden />
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </li>
          )}
        </ul>
      </BottomSheetContent>

      <PlayerModal
        player={infoPlayer}
        open={infoPlayer != null}
        onOpenChange={(next) => {
          if (!next) setInfoId(null);
        }}
        isStarter={false}
        isCaptain={false}
        isVice={false}
        fixtureLabel={infoPlayer ? fixtureLabel(infoPlayer) : undefined}
        canEdit={false}
        history={infoPlayer ? historyFor(infoPlayer) : undefined}
      />
    </Dialog>
  );
}
