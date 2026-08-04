import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/user";
import { getActiveSeasonContext, getUserFantasyTeam } from "@/lib/game/queries";
import { TeamCreated } from "@/components/onboarding/team-created";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.created");
  return { title: t("title") };
}

export default async function OnboardingSuccessPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { season } = await getActiveSeasonContext();
  const team = await getUserFantasyTeam(user.id, season.id);
  // Landed here without a team (direct URL / already reset) — nothing to celebrate.
  if (!team) redirect("/onboarding");

  return <TeamCreated teamName={team.name} />;
}
