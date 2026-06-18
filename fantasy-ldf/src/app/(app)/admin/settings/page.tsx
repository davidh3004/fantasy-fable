import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/admin/settings-form";
import { getActiveSeasonContext } from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("settings") };
}

export default async function AdminSettingsPage() {
  const { settings } = await getActiveSeasonContext();

  return (
    <SettingsForm
      values={{
        budget: settings.budget,
        squadSize: settings.squadSize,
        gkCount: settings.gkCount,
        defCount: settings.defCount,
        midCount: settings.midCount,
        fwdCount: settings.fwdCount,
        startingSize: settings.startingSize,
        minDef: settings.minDef,
        minMid: settings.minMid,
        minFwd: settings.minFwd,
        maxPerClub: settings.maxPerClub,
        freeTransfersPerGw: settings.freeTransfersPerGw,
        maxBankedTransfers: settings.maxBankedTransfers,
        transferHitCost: settings.transferHitCost,
        deadlineOffsetMinutes: settings.deadlineOffsetMinutes,
        wildcardsPerSeason: settings.wildcardsPerSeason,
      }}
    />
  );
}
