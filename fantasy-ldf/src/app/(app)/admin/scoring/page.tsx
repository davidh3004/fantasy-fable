import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { scoringRules } from "@/db/schema";
import { ScoringForm } from "@/components/admin/scoring-form";
import { getActiveSeasonContext } from "@/lib/game/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("scoring") };
}

export default async function AdminScoringPage() {
  const { season } = await getActiveSeasonContext();

  const rules = await db
    .select({
      id: scoringRules.id,
      eventKey: scoringRules.eventKey,
      position: scoringRules.position,
      points: scoringRules.points,
    })
    .from(scoringRules)
    .where(eq(scoringRules.seasonId, season.id))
    .orderBy(asc(scoringRules.eventKey));

  return <ScoringForm rules={rules} />;
}
