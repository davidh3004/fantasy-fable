import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Brand panel — desktop only, decorative */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1d1145] via-background to-background p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        {/* Geometric blocks */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-16 -left-16 size-64 rotate-12 rounded-3xl bg-primary/20" />
          <div className="absolute top-1/3 -right-20 size-72 -rotate-12 rounded-3xl bg-primary/10" />
          <div className="absolute bottom-24 left-1/4 size-40 rotate-45 rounded-2xl bg-cta/15" />
          <div className="absolute -bottom-20 -right-10 size-56 rotate-12 rounded-3xl bg-primary/15" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary">
            <Trophy className="size-6 text-primary-foreground" aria-hidden />
          </div>
          <span className="font-heading text-2xl tracking-wide">{APP_NAME}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-heading text-5xl leading-tight">{t("tagline")}</h2>
        </div>

        <p className="relative text-sm text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary">
              <Trophy className="size-5 text-primary-foreground" aria-hidden />
            </div>
            <span className="font-heading text-xl tracking-wide">{APP_NAME}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
