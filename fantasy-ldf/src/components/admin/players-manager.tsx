"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlert } from "@/components/auth/auth-alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/game/format";
import { deletePlayer, savePlayer } from "@/app/(app)/admin/actions";
import { POSITION_ORDER } from "@/lib/game/squad";
import type { MarketPlayer } from "@/lib/game/queries";

const STATUSES = ["available", "injured", "suspended", "unavailable"] as const;

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type ClubOption = { id: string; name: string };

type Filters = { q: string; club: string; pos: string };

export function PlayersManager({
  players,
  total,
  page,
  pageSize,
  clubs,
  filters,
}: {
  players: MarketPlayer[];
  total: number;
  page: number;
  pageSize: number;
  clubs: ClubOption[];
  filters: Filters;
}) {
  const t = useTranslations("admin.players");
  const tCommon = useTranslations("admin.common");
  const tGlobal = useTranslations("common");
  const tPos = useTranslations("positionsShort");
  const tStatus = useTranslations("team.status");

  const router = useRouter();
  const pathname = usePathname();
  const [navPending, startNav] = useTransition();

  const [searchInput, setSearchInput] = useState(filters.q);
  const [editing, setEditing] = useState<MarketPlayer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  /** Push the current filters/page into the URL — the server refetches. */
  function go(next: Partial<Filters & { page: number }>) {
    const q = next.q ?? filters.q;
    const club = next.club ?? filters.club;
    const pos = next.pos ?? filters.pos;
    const page = next.page ?? 1; // any filter change returns to page 1
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (club !== "all") params.set("club", club);
    if (pos !== "all") params.set("pos", pos);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    startNav(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  // Debounce typing into a single navigation.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const id = setTimeout(() => go({ q: searchInput }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await savePlayer({}, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setDialogOpen(false);
        toast.success(tCommon("saved"));
      }
    });
  }

  function openDialog(player: MarketPlayer | null) {
    setEditing(player);
    setError(undefined);
    setDialogOpen(true);
  }

  function handleDelete(playerId: string) {
    startTransition(async () => {
      const result = await deletePlayer(playerId);
      if (result.error) toast.error(tCommon(`errors.${result.error}`));
      else toast.success(tCommon("deleted"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search")}
            className="h-10 pl-9"
          />
        </div>
        <select
          value={filters.club}
          onChange={(e) => go({ club: e.target.value })}
          className={cn(selectClass, "w-auto")}
          aria-label={t("filterClub")}
        >
          <option value="all">{t("allClubs")}</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
        <select
          value={filters.pos}
          onChange={(e) => go({ pos: e.target.value })}
          className={cn(selectClass, "w-auto")}
          aria-label={t("filterPosition")}
        >
          <option value="all">{t("allPositions")}</option>
          {POSITION_ORDER.map((pos) => (
            <option key={pos} value={pos}>
              {tPos(pos)}
            </option>
          ))}
        </select>
        <Button onClick={() => openDialog(null)} className="h-10 cursor-pointer">
          <Plus className="size-4" aria-hidden />
          {t("new")}
        </Button>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {t("count", { count: total })}
        {navPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      </p>

      <ul className={cn("flex flex-col gap-1.5", navPending && "opacity-60")}>
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2"
          >
            {player.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full border border-border object-cover object-top"
              />
            ) : (
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <svg
                  viewBox="0 0 40 40"
                  className="size-6 text-muted-foreground"
                  fill="currentColor"
                >
                  <circle cx="20" cy="14" r="7" />
                  <path d="M6 40c0-9 6.5-14 14-14s14 5 14 14z" />
                </svg>
              </span>
            )}
            <span
              className={cn(
                "w-10 shrink-0 rounded-md px-1 py-0.5 text-center text-xs font-semibold",
                player.position === "GK" && "bg-yellow-400/15 text-yellow-300",
                player.position === "DEF" && "bg-cyan-400/15 text-cyan-300",
                player.position === "MID" &&
                  "bg-emerald-400/15 text-emerald-300",
                player.position === "FWD" && "bg-rose-400/15 text-rose-300"
              )}
            >
              {tPos(player.position)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {player.firstName} {player.lastName}
                {player.status !== "available" && (
                  <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] uppercase text-red-300">
                    {tStatus(player.status)}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {player.clubName}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(player.price)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDialog(player)}
              aria-label={tCommon("edit")}
              className="cursor-pointer"
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tCommon("delete")}
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              }
              title={tCommon("confirmDelete", {
                name: `${player.firstName} ${player.lastName}`,
              })}
              confirmLabel={tCommon("delete")}
              cancelLabel={tGlobal("cancel")}
              onConfirm={() => handleDelete(player.id)}
            />
          </li>
        ))}
        {players.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </li>
        )}
      </ul>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1 || navPending}
            onClick={() => go({ page: page - 1 })}
            aria-label={t("prevPage")}
            className="cursor-pointer"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages || navPending}
            onClick={() => go({ page: page + 1 })}
            aria-label={t("nextPage")}
            className="cursor-pointer"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("new")}</DialogTitle>
          </DialogHeader>
          <form
            key={editing?.id ?? "new"}
            action={handleSubmit}
            className="flex flex-col gap-3.5"
          >
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            {error && (
              <AuthAlert variant="error" message={tCommon(`errors.${error}`)} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-firstName">{t("firstName")}</Label>
                <Input
                  id="p-firstName"
                  name="firstName"
                  defaultValue={editing?.firstName}
                  required
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-lastName">{t("lastName")}</Label>
                <Input
                  id="p-lastName"
                  name="lastName"
                  defaultValue={editing?.lastName}
                  required
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-clubId">{t("club")}</Label>
                <select
                  id="p-clubId"
                  name="clubId"
                  defaultValue={editing?.clubId ?? clubs[0]?.id}
                  className={selectClass}
                >
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-position">{t("position")}</Label>
                <select
                  id="p-position"
                  name="position"
                  defaultValue={editing?.position ?? "MID"}
                  className={selectClass}
                >
                  {POSITION_ORDER.map((pos) => (
                    <option key={pos} value={pos}>
                      {tPos(pos)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-price">{t("price")}</Label>
                <Input
                  id="p-price"
                  name="price"
                  type="number"
                  step="0.1"
                  min="0.1"
                  defaultValue={editing ? (editing.price / 10).toFixed(1) : "5.0"}
                  required
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-status">{t("status")}</Label>
                <select
                  id="p-status"
                  name="status"
                  defaultValue={editing?.status ?? "available"}
                  className={selectClass}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {tStatus(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-photoUrl">{t("photoUrl")}</Label>
              <Input
                id="p-photoUrl"
                name="photoUrl"
                defaultValue={editing?.photoUrl ?? ""}
                placeholder="https://..."
                className="h-10"
              />
            </div>
            <div className="flex items-center gap-3">
              {editing?.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editing.photoUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-12 shrink-0 rounded-full border border-border object-cover object-top"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="p-photoFile">{tCommon("uploadImage")}</Label>
                <Input
                  id="p-photoFile"
                  name="photoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="h-10 cursor-pointer pt-2 text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {tCommon("uploadHint")}
                </p>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="mt-1 h-11 cursor-pointer font-semibold"
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {tCommon("save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
