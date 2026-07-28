"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createFantasyTeam } from "@/app/onboarding/actions";
import { buildInitialLineup, type SquadSettings } from "@/lib/game/squad";
import type { LineupState } from "@/lib/game/lineup";
import type { MarketPlayer } from "@/lib/game/queries";
import { SquadPicker } from "./squad-picker";
import { WelcomeStep } from "./welcome-step";
import { LineupStep } from "./lineup-step";
import { CaptainStep } from "./captain-step";

type ClubOption = {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string | null;
};

type OnboardingWizardProps = {
  clubs: ClubOption[];
  players: MarketPlayer[];
  settings: SquadSettings;
};

const TOTAL_STEPS = 5;

export function OnboardingWizard({
  clubs,
  players,
  settings,
}: OnboardingWizardProps) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [teamName, setTeamName] = useState("");
  const [favoriteClubId, setFavoriteClubId] = useState<string | null>(null);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [lineup, setLineup] = useState<LineupState | null>(null);
  const [captainId, setCaptainId] = useState<string>("");
  const [viceId, setViceId] = useState<string>("");
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const squadPlayers = useMemo(
    () => squadIds.map((id) => playerById.get(id)!),
    [squadIds, playerById]
  );

  const trimmedName = teamName.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 30;

  /** Squad confirmed → keep the lineup if the squad didn't change. */
  function handleSquadConfirm(playerIds: string[]) {
    const sameSquad =
      lineup &&
      playerIds.length === squadIds.length &&
      new Set([...playerIds, ...squadIds]).size === squadIds.length;

    setSquadIds(playerIds);

    if (!sameSquad) {
      const picked = playerIds.map((id) => playerById.get(id)!);
      const initial = buildInitialLineup(picked);
      setLineup({
        starterIds: initial.starters.map((p) => p.id),
        benchIds: initial.bench.map((p) => p.id),
      });
      setCaptainId(initial.captainId);
      setViceId(initial.viceId);
    }
    setStep(4);
  }

  function handleSubmit() {
    if (!lineup) return;
    setServerError(undefined);
    startTransition(async () => {
      const result = await createFantasyTeam({
        teamName: trimmedName,
        favoriteClubId,
        playerIds: squadIds,
        starterIds: lineup.starterIds,
        benchIds: lineup.benchIds,
        captainId,
        viceId,
      });
      if (result?.error) setServerError(result.error);
    });
  }

  const errorMessage = serverError
    ? t(`errors.${serverError}`, {
        count: settings.squadSize,
        max: settings.maxPerClub,
      })
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <p className="shrink-0 text-sm text-muted-foreground">
          {t("step", { current: step, total: TOTAL_STEPS })}
        </p>
        <Progress
          value={(step / TOTAL_STEPS) * 100}
          className="h-1.5 max-w-40"
        />
      </div>

      {step === 1 && (
        <WelcomeStep settings={settings} onContinue={() => setStep(2)} />
      )}

      {step === 2 && (
        <div className="mx-auto w-full max-w-xl">
          <h2 className="font-heading text-2xl">{t("identityTitle")}</h2>

          <div className="mt-6 flex flex-col gap-2">
            <Label htmlFor="teamName">{t("teamName")}</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={t("teamNamePlaceholder")}
              maxLength={30}
              className="h-11"
              aria-describedby="teamName-hint"
            />
            <p id="teamName-hint" className="text-xs text-muted-foreground">
              {t("teamNameHint")}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm font-medium">{t("favoriteClub")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFavoriteClubId(null)}
                aria-pressed={favoriteClubId === null}
                className={cn(
                  "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center transition-colors",
                  favoriteClubId === null
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <Ban className="size-6" />
                </span>
                <span className="text-sm font-medium">{t("noFavorite")}</span>
              </button>
              {clubs.map((club) => (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => setFavoriteClubId(club.id)}
                  aria-pressed={favoriteClubId === club.id}
                  className={cn(
                    "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center transition-colors",
                    favoriteClubId === club.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <span
                    className="flex size-14 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: club.primaryColor ?? "#7c3aed" }}
                    aria-hidden
                  >
                    {club.shortName}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium leading-tight">
                    {club.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="h-11 cursor-pointer"
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={!nameValid}
              className="h-11 cursor-pointer font-semibold px-10"
            >
              {t("continue")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="mb-4 font-heading text-2xl">{t("squadTitle")}</h2>
          <SquadPicker
            players={players}
            settings={settings}
            initialSelectedIds={squadIds}
            onSubmit={handleSquadConfirm}
            onBack={() => setStep(2)}
            isPending={false}
          />
        </div>
      )}

      {step === 4 && lineup && (
        <LineupStep
          players={squadPlayers}
          settings={settings}
          lineup={lineup}
          onLineupChange={setLineup}
          onBack={() => setStep(3)}
          onContinue={() => {
            // Captain/vice must be starters; reset them if they got benched.
            let nextCaptain = captainId;
            let nextVice = viceId;
            if (!lineup.starterIds.includes(nextCaptain)) {
              nextCaptain = lineup.starterIds[0];
            }
            if (
              !lineup.starterIds.includes(nextVice) ||
              nextVice === nextCaptain
            ) {
              nextVice =
                lineup.starterIds.find((id) => id !== nextCaptain) ?? nextVice;
            }
            setCaptainId(nextCaptain);
            setViceId(nextVice);
            setStep(5);
          }}
        />
      )}

      {step === 5 && lineup && (
        <CaptainStep
          players={squadPlayers}
          starterIds={lineup.starterIds}
          captainId={captainId}
          viceId={viceId}
          onChange={(c, v) => {
            setCaptainId(c);
            setViceId(v);
          }}
          onBack={() => setStep(4)}
          onSubmit={handleSubmit}
          isPending={isPending}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
