import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/user";
import { APP_NAME } from "@/lib/config";
import {
  getActiveSeasonContext,
  getClubsByCompetition,
  getMarketPlayers,
  getUserFantasyTeam,
  toSquadSettings,
} from "@/lib/game/queries";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { season, settings } = await getActiveSeasonContext();

  const [existingTeam, clubList, playerList] = await Promise.all([
    getUserFantasyTeam(user.id, season.id),
    getClubsByCompetition(season.competitionId),
    getMarketPlayers(season.competitionId),
  ]);
  if (existingTeam) redirect("/home");

  const t = await getTranslations("onboarding");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
          <Trophy className="size-5 text-primary-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {APP_NAME}
          </p>
          <h1 className="font-heading text-2xl leading-tight">{t("title")}</h1>
        </div>
      </div>

      <OnboardingWizard
        clubs={clubList.map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.shortName,
          primaryColor: c.primaryColor,
        }))}
        players={playerList}
        settings={toSquadSettings(settings)}
      />
    </main>
  );
}
