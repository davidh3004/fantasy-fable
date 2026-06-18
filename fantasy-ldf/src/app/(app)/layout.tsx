import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/user";
import { AppNav } from "@/components/shell/app-nav";
import { APP_NAME } from "@/lib/config";
import { Trophy } from "lucide-react";
import Link from "next/link";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const displayName = user.displayName || (user.email ?? "");

  return (
    <div className="flex min-h-dvh w-full">
      <AppNav displayName={displayName} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center border-b border-border px-4 lg:hidden">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Trophy className="size-4.5 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-heading tracking-wide">{APP_NAME}</span>
          </Link>
        </header>

        {/* pb clears the fixed mobile tab bar */}
        <div className="flex flex-1 flex-col pb-24 lg:pb-8">{children}</div>
      </div>
    </div>
  );
}
