import Link from "next/link";
import { Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary">
        <Trophy className="size-7 text-primary-foreground" aria-hidden />
      </div>
      <div>
        <p className="font-heading text-5xl text-primary">404</p>
        <h1 className="mt-2 font-heading text-2xl">{t("title")}</h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {t("body")}
        </p>
      </div>
      <Button
        render={<Link href="/home" />}
        nativeButton={false}
        className="h-11 cursor-pointer px-8 font-semibold"
      >
        {t("cta")}
      </Button>
      <p className="text-xs text-muted-foreground">{APP_NAME}</p>
    </main>
  );
}
