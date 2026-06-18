import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/user";

/** Fast read-path guard for admin pages (local JWT + one profile lookup). */
export async function requireAdminPage(): Promise<{ userId: string } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const [profile] = await db
    .select({ isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  return profile?.isAdmin ? { userId: user.id } : null;
}

/** Authoritative guard for admin server actions (revalidates with Auth API). */
export async function requireAdminAction(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile] = await db
    .select({ isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  return profile?.isAdmin ? { userId: user.id } : null;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return Boolean(profile?.isAdmin);
}
