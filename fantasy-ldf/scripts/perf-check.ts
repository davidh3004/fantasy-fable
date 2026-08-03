/**
 * Authenticated page-timing check against a running dev/prod server.
 * Signs in as the test user via the Supabase API, builds the @supabase/ssr
 * cookie, and times server renders. Run: npx tsx scripts/perf-check.ts [port]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const PORT = process.argv[2] ?? "3000";
const BASE = `http://localhost:${PORT}`;
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
  "."
)[0];

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "test-user@example.com";

function requireTestPassword(): string {
  const pw = process.env.TEST_USER_PASSWORD;
  if (!pw) {
    console.error("Set TEST_USER_PASSWORD in .env.local before running this script.");
    process.exit(1);
  }
  return pw;
}
const TEST_PASSWORD = requireTestPassword();

function chunkCookie(name: string, value: string): string {
  // Mirrors @supabase/ssr: values > 3180 chars are split into name.0, name.1…
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return parts.join("; ");
}

async function main() {
  const authRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    }
  );
  if (!authRes.ok) throw new Error(`login failed: ${await authRes.text()}`);
  const session = await authRes.json();

  const sessionJson = JSON.stringify(session);
  const encoded =
    "base64-" + Buffer.from(sessionJson).toString("base64url");
  const cookie = chunkCookie(`sb-${REF}-auth-token`, encoded);

  const paths = ["/home", "/team", "/more", "/home", "/team", "/more", "/home", "/home"];
  const times: Record<string, number[]> = {};

  // Warm-up pass (route compile, pool, JWKS)
  for (const p of ["/home", "/team", "/more"]) {
    await fetch(`${BASE}${p}`, { headers: { cookie }, redirect: "manual" });
  }

  for (const path of paths) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });
    await res.text();
    const ms = Math.round(performance.now() - t0);
    (times[path] = times[path] ?? []).push(ms);
    if (res.status !== 200) {
      console.log(`${path} -> HTTP ${res.status} (auth failed?)`);
    }
  }

  for (const [path, list] of Object.entries(times)) {
    const median = [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
    console.log(
      `${path.padEnd(10)} median ${median}ms  samples [${list.join(", ")}]`
    );
  }
}

main();
