import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Session pooler for DDL; falls back to the app URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
