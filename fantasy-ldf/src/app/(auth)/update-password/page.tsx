import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getPasswordChangeContext } from "@/lib/auth/password-change";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.update");
  return { title: t("title") };
}

export default async function UpdatePasswordPage() {
  const t = await getTranslations("auth.update");

  // Only decides whether to render the field — the action checks again itself.
  const context = await getPasswordChangeContext();
  if (!context) redirect("/login");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <UpdatePasswordForm needsCurrentPassword={context.needsCurrentPassword} />
    </div>
  );
}
