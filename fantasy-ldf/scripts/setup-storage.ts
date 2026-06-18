/** Creates the public `media` bucket + admin-only write policies. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  await sql`
    insert into storage.buckets (id, name, public)
    values ('media', 'media', true)
    on conflict (id) do update set public = true
  `;
  console.log("bucket 'media' ready (public read)");

  // profiles has deny-all RLS, so the check must run as a SECURITY DEFINER
  // function (otherwise the policy's subquery always comes back empty).
  await sql`
    create or replace function public.is_admin() returns boolean
    language sql security definer stable
    set search_path = public
    as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$
  `;
  await sql`revoke all on function public.is_admin() from public`;
  await sql`grant execute on function public.is_admin() to authenticated`;

  // Idempotent policies: only admins may write.
  await sql`drop policy if exists "media_admin_insert" on storage.objects`;
  await sql`
    create policy "media_admin_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'media' and public.is_admin())
  `;
  await sql`drop policy if exists "media_admin_update" on storage.objects`;
  await sql`
    create policy "media_admin_update" on storage.objects for update to authenticated
    using (bucket_id = 'media' and public.is_admin())
  `;
  await sql`drop policy if exists "media_admin_delete" on storage.objects`;
  await sql`
    create policy "media_admin_delete" on storage.objects for delete to authenticated
    using (bucket_id = 'media' and public.is_admin())
  `;
  console.log("admin write policies created (via is_admin() security definer)");
}

main()
  .catch((e) => console.error("ERROR:", e.message))
  .finally(() => sql.end());
