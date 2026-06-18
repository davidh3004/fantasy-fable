# Fantasy LDF

FPL-style fantasy soccer platform, built league-agnostic. First league: **Liga Dominicana de Fútbol**. Spanish-first, dark-themed, responsive, installable PWA.

> `Fantasy LDF` is a placeholder name (single constant in `fantasy-ldf/src/lib/config.ts`).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (Postgres + Auth + Storage) · Drizzle ORM · next-intl. Deploys to Vercel.

The app lives in [`fantasy-ldf/`](fantasy-ldf). Full product + technical spec: [`SPEC.md`](SPEC.md).

## Features

Auth (email + Google) · onboarding (squad builder + pitch lineup + captain) · home dashboard with live deadline countdown · team management (pitch view, player sheet, formation/captain, gameweek history, live points) · transfers (market, budget, hits, review) · leagues (global + private invite-code, rival squads) · matches (fixtures, results, per-player stats) · full admin panel (clubs, players, fixtures, gameweeks, results entry, scoring rules, settings, image uploads) · gameweek engine (auto-subs, captain ×2, ranks).

Every game rule (squad size, budget, scoring, transfer costs…) is configuration in the DB, not code — so the platform adapts to any league.

## Local setup

```bash
cd fantasy-ldf
npm install
cp .env.local.example .env.local   # fill in Supabase + DB values
npm run db:push                      # create schema
npm run db:seed                      # sample league data (replace via /admin)
npm run dev
```

See `fantasy-ldf/scripts/` for dev helpers (seed, set-admin, gameweek simulation, etc.).

## Deploy

Vercel project with **root directory = `fantasy-ldf`**. Set the env vars from `.env.local.example` (incl. `NEXT_PUBLIC_SITE_URL` = deployed origin). Supabase email templates + Google OAuth redirect URLs must point at the deployed origin.
