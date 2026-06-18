import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.update");
  return { title: t("title") };
}

export default async function UpdatePasswordPage() {
  const t = await getTranslations("auth.update");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
