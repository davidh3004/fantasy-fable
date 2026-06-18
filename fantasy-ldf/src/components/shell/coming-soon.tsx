import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

type ComingSoonProps = {
  title: string;
  Icon: LucideIcon;
};

export async function ComingSoon({ title, Icon }: ComingSoonProps) {
  const t = await getTranslations("comingSoon");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl">{title}</h1>
      <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15">
          <Icon className="size-7 text-primary" aria-hidden />
        </div>
        <div>
          <p className="font-heading text-lg">{t("title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>
        </div>
      </div>
    </main>
  );
}
