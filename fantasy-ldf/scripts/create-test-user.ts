/**
 * Creates a confirmed test user for local development directly in the
 * auth schema (no email involved, avoids send rate limits).
 *
 * Run: npx tsx scripts/create-test-user.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const EMAIL = process.env.TEST_USER_EMAIL ?? "test-user@example.com";

function requireTestPassword(): string {
  const pw = process.env.TEST_USER_PASSWORD;
  if (!pw || pw.length < 8) {
    console.error(
      "Set TEST_USER_PASSWORD (min 8 chars) in .env.local before running this script."
    );
    process.exit(1);
  }
  return pw;
}
const PASSWORD = requireTestPassword();

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const existing = await sql`
    select id from auth.users where email = ${EMAIL}
  `;
  if (existing.length > 0) {
    // Reset to a known state: confirmed + known password
    await sql`
      update auth.users
      set encrypted_password = extensions.crypt(${PASSWORD}, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now())
      where email = ${EMAIL}
    `;
    console.log("User already existed - password reset and confirmed.");
  } else {
    const [user] = await sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', ${EMAIL},
        extensions.crypt(${PASSWORD}, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}',
        '{"display_name":"Tester"}', now(), now(), '', '', '', ''
      ) returning id
    `;
    await sql`
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), ${user.id}, ${user.id},
        jsonb_build_object('sub', ${user.id}::text, 'email', ${EMAIL}, 'email_verified', true),
        'email', now(), now(), now()
      )
    `;
    console.log(`Created test user: ${user.id}`);
  }

  await sql.end();
  console.log(`\nTest login -> ${EMAIL} / ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
