import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdminPage();
  if (!admin) notFound();

  const t = await getTranslations("admin");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-cta/15">
          <ShieldCheck className="size-5 text-cta" aria-hidden />
        </span>
        <h1 className="font-heading text-2xl">{t("title")}</h1>
      </div>
      <AdminNav />
      <div className="mt-5">{children}</div>
    </main>
  );
}
