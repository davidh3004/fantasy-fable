"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  FlagTriangleRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wand2,
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
import { cn } from "@/lib/utils";
import { toAstInputValue } from "@/lib/game/format";
import {
  deleteFixture,
  deleteGameweek,
  finalizeGameweek,
  recomputeDeadline,
  saveFixture,
  saveGameweek,
} from "@/app/(app)/admin/actions";

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export type AdminFixture = {
  id: string;
  gameweekId: string;
  homeClubId: string;
  awayClubId: string;
  homeShort: string;
  awayShort: string;
  kickoff: Date;
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
};

export type AdminGameweek = {
  id: string;
  number: number;
  deadline: Date;
  status: "upcoming" | "locked" | "finished";
  fixtures: AdminFixture[];
};

type ClubOption = { id: string; name: string };

const STATUS_BADGE: Record<AdminGameweek["status"], string> = {
  upcoming: "bg-emerald-400/15 text-emerald-300",
  locked: "bg-yellow-400/15 text-yellow-300",
  finished: "bg-muted text-muted-foreground",
};

export function GameweeksManager({
  gameweeks,
  clubs,
  locale,
}: {
  gameweeks: AdminGameweek[];
  clubs: ClubOption[];
  locale: string;
}) {
  const t = useTranslations("admin.gameweeks");
  const tCommon = useTranslations("admin.common");

  const [gwDialog, setGwDialog] = useState(false);
  const [editingGw, setEditingGw] = useState<AdminGameweek | null>(null);
  const [fixtureDialog, setFixtureDialog] = useState(false);
  const [fixtureGwId, setFixtureGwId] = useState<string>("");
  const [editingFixture, setEditingFixture] = useState<AdminFixture | null>(
    null
  );

  const [gwError, setGwError] = useState<string>();
  const [fxError, setFxError] = useState<string>();
  const [gwPending, startGwTransition] = useTransition();
  const [fxPending, startFxTransition] = useTransition();
  const [, startTransition] = useTransition();

  function submitGameweek(formData: FormData) {
    startGwTransition(async () => {
      const result = await saveGameweek({}, formData);
      if (result?.error) {
        setGwError(result.error);
      } else {
        setGwError(undefined);
        setGwDialog(false);
        toast.success(tCommon("saved"));
      }
    });
  }

  function submitFixture(formData: FormData) {
    startFxTransition(async () => {
      const result = await saveFixture({}, formData);
      if (result?.error) {
        setFxError(result.error);
      } else {
        setFxError(undefined);
        setFixtureDialog(false);
        toast.success(tCommon("saved"));
      }
    });
  }

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Santo_Domingo",
    }).format(date);

  function runAction(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(tCommon(`errors.${result.error}`));
      else toast.success(tCommon("saved"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("count", { count: gameweeks.length })}
        </p>
        <Button
          onClick={() => {
            setEditingGw(null);
            setGwError(undefined);
            setGwDialog(true);
          }}
          className="h-10 cursor-pointer"
        >
          <Plus className="size-4" aria-hidden />
          {t("new")}
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {gameweeks.map((gw) => (
          <li
            key={gw.id}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg">
                {t("gameweek", { number: gw.number })}
              </h2>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  STATUS_BADGE[gw.status]
                )}
              >
                {t(`status.${gw.status}`)}
              </span>
              <span className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden />
                {formatDate(gw.deadline)}
              </span>
              <span className="ml-auto flex gap-1">
                {gw.status !== "finished" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (window.confirm(t("confirmFinalize", { number: gw.number }))) {
                        runAction(() => finalizeGameweek(gw.id));
                      }
                    }}
                    aria-label={t("finalize")}
                    title={t("finalize")}
                    className="cursor-pointer text-emerald-300 hover:text-emerald-200"
                  >
                    <FlagTriangleRight className="size-4" aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => runAction(() => recomputeDeadline(gw.id))}
                  aria-label={t("recompute")}
                  title={t("recompute")}
                  className="cursor-pointer"
                >
                  <Wand2 className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditingGw(gw);
                    setGwError(undefined);
                    setGwDialog(true);
                  }}
                  aria-label={tCommon("edit")}
                  className="cursor-pointer"
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        tCommon("confirmDelete", {
                          name: t("gameweek", { number: gw.number }),
                        })
                      )
                    ) {
                      runAction(() => deleteGameweek(gw.id));
                    }
                  }}
                  aria-label={tCommon("delete")}
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </span>
            </div>

            <ul className="mt-3 flex flex-col gap-1.5">
              {gw.fixtures.map((fixture) => (
                <li
                  key={fixture.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium tabular-nums">
                    {fixture.homeShort}
                    {fixture.homeScore != null && fixture.awayScore != null
                      ? ` ${fixture.homeScore}-${fixture.awayScore} `
                      : " — "}
                    {fixture.awayShort}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(fixture.kickoff)}
                  </span>
                  {fixture.status === "finished" && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {t("finished")}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEditingFixture(fixture);
                        setFixtureGwId(gw.id);
                        setFxError(undefined);
                        setFixtureDialog(true);
                      }}
                      aria-label={tCommon("edit")}
                      className="cursor-pointer"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        if (
                          window.confirm(
                            tCommon("confirmDelete", {
                              name: `${fixture.homeShort} - ${fixture.awayShort}`,
                            })
                          )
                        ) {
                          runAction(() => deleteFixture(fixture.id));
                        }
                      }}
                      aria-label={tCommon("delete")}
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              onClick={() => {
                setEditingFixture(null);
                setFixtureGwId(gw.id);
                setFxError(undefined);
                setFixtureDialog(true);
              }}
              className="mt-2.5 h-9 cursor-pointer text-xs"
            >
              <Plus className="size-3.5" aria-hidden />
              {t("addFixture")}
            </Button>
          </li>
        ))}
      </ul>

      {/* Gameweek dialog */}
      <Dialog open={gwDialog} onOpenChange={setGwDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingGw
                ? t("editTitle", { number: editingGw.number })
                : t("new")}
            </DialogTitle>
          </DialogHeader>
          <form
            key={editingGw?.id ?? "new"}
            action={submitGameweek}
            className="flex flex-col gap-3.5"
          >
            <input type="hidden" name="id" value={editingGw?.id ?? ""} />
            {gwError && (
              <AuthAlert variant="error" message={tCommon(`errors.${gwError}`)} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gw-number">{t("number")}</Label>
                <Input
                  id="gw-number"
                  name="number"
                  type="number"
                  min="1"
                  defaultValue={
                    editingGw?.number ??
                    (gameweeks.length > 0
                      ? Math.max(...gameweeks.map((g) => g.number)) + 1
                      : 1)
                  }
                  required
                  className="h-10 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gw-status">{t("statusLabel")}</Label>
                <select
                  id="gw-status"
                  name="status"
                  defaultValue={editingGw?.status ?? "upcoming"}
                  className={selectClass}
                >
                  {(["upcoming", "locked", "finished"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gw-deadline">{t("deadlineLabel")}</Label>
              <Input
                id="gw-deadline"
                name="deadline"
                type="datetime-local"
                defaultValue={
                  editingGw ? toAstInputValue(editingGw.deadline) : ""
                }
                required
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">{t("astHint")}</p>
            </div>
            <Button
              type="submit"
              disabled={gwPending}
              className="mt-1 h-11 cursor-pointer font-semibold"
            >
              {gwPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {tCommon("save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fixture dialog */}
      <Dialog open={fixtureDialog} onOpenChange={setFixtureDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingFixture ? t("editFixture") : t("addFixture")}
            </DialogTitle>
          </DialogHeader>
          <form
            key={editingFixture?.id ?? `new-${fixtureGwId}`}
            action={submitFixture}
            className="flex flex-col gap-3.5"
          >
            <input type="hidden" name="id" value={editingFixture?.id ?? ""} />
            <input type="hidden" name="gameweekId" value={fixtureGwId} />
            {fxError && (
              <AuthAlert variant="error" message={tCommon(`errors.${fxError}`)} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fx-home">{t("home")}</Label>
                <select
                  id="fx-home"
                  name="homeClubId"
                  defaultValue={editingFixture?.homeClubId ?? clubs[0]?.id}
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
                <Label htmlFor="fx-away">{t("away")}</Label>
                <select
                  id="fx-away"
                  name="awayClubId"
                  defaultValue={editingFixture?.awayClubId ?? clubs[1]?.id}
                  className={selectClass}
                >
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fx-kickoff">{t("kickoff")}</Label>
              <Input
                id="fx-kickoff"
                name="kickoff"
                type="datetime-local"
                defaultValue={
                  editingFixture ? toAstInputValue(editingFixture.kickoff) : ""
                }
                required
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">{t("astHint")}</p>
            </div>
            <Button
              type="submit"
              disabled={fxPending}
              className="mt-1 h-11 cursor-pointer font-semibold"
            >
              {fxPending && (
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
