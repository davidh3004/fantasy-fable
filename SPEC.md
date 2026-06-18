# Fantasy LDF — Product & Technical Specification

> Fantasy sports platform, FPL-style. First league: Liga Dominicana de Fútbol (Dominican Republic).
> Built league-agnostic: every game rule is configuration, not code.
> App name "Fantasy LDF" is a placeholder — single constant to change later.

---

## 1. Decisions Log (agreed 2026-06-10)

| Area | Decision |
|---|---|
| Platform | Web first (responsive), mobile app later (Expo/React Native or PWA) |
| Language | Spanish first, i18n-ready from day one (next-intl) |
| Game rules | FPL structure, every number admin-configurable per league |
| Auth | Email + password, Google OAuth (Supabase Auth) |
| Data entry | Manual via admin panel (no LDF API exists) |
| Scoring | Core FPL scoring + admin manually picks 3 bonus players per match |
| Transfers | FPL current rules: 1 free/GW, bank up to 5, -4 pts per extra, unlimited pre-season |
| Chips v1 | Wildcard only (others v2) |
| Prices | Static in v1, admin-set; schema ready for dynamic later |
| Leagues | Global overall + private classic (invite code); H2H deferred to v2 |
| Deadline | Auto: 90 min before first fixture of GW (offset configurable) |
| Hosting | Vercel (app) + Supabase (DB/auth) — user already has accounts |

## 2. Tech Stack

- **Next.js 15** (App Router, TypeScript, src dir, Turbopack) — folder `fantasy-ldf/`
- **Tailwind CSS v4 + shadcn/ui** — UI components
- **Supabase** — Postgres, Auth (email + Google), Row Level Security
  - Auth checks on reads use local JWT verification (jose + cached JWKS), not per-request Auth API calls; `getUser()` only in mutating server actions
  - DB: transaction pooler (6543) for app runtime, session pooler (5432) via `DIRECT_URL` for migrations; page queries batched into parallel stages
- **Drizzle ORM** — schema + migrations in repo
- **next-intl** — i18n, Spanish (`es`) default, English (`en`) later
- **Vercel** — hosting
- Mobile later: Expo (reuses types + API) or PWA first

## 3. Design System (from ui-ux-pro-max)

- **Style:** Vibrant & block-based, dark-first, gaming/sports energy
- **Colors:** Primary `#7C3AED` (neon purple) · Accent/CTA `#F43F5E` (rose) · Background `#0F0F23` · Foreground `#E2E8F0` · Muted `#27273B` · Border `#4C1D95` · Destructive `#EF4444`
- **Type:** Headings **Russo One**, body **Chakra Petch** (Google Fonts)
- **Effects:** big section gaps, bold hover color shifts, 200–300ms transitions, large display type
- **Rules:** WCAG 4.5:1 contrast, 44px touch targets, no emoji icons (Lucide), visible focus rings, prefers-reduced-motion, mobile-first 375/768/1024/1440
- **Navigation:** bottom tab bar on mobile (≤5 items), sidebar/top nav on desktop

## 4. Game Rules (defaults, all configurable per league via `game_settings`)

### Squad
- 15 players: 2 GK, 5 DEF, 5 MID, 3 FWD
- Budget: 100.0 (currency display configurable, placeholder `$`)
- Max 3 players per real club
- Starting XI each GW: formation must have 1 GK, ≥3 DEF, ≥2 MID, ≥1 FWD
- Bench of 4 ordered (1 GK + 3 outfield), captain + vice-captain

### Scoring (per match)
| Event | Points |
|---|---|
| Played 1–59 min | 1 |
| Played 60+ min | 2 |
| Goal: GK/DEF | 6 |
| Goal: MID | 5 |
| Goal: FWD | 4 |
| Assist | 3 |
| Clean sheet GK/DEF (60+ min) | 4 |
| Clean sheet MID (60+ min) | 1 |
| Every 3 GK saves | 1 |
| Penalty save | 5 |
| Penalty miss | -2 |
| Every 2 goals conceded (GK/DEF) | -1 |
| Yellow card | -1 |
| Red card | -3 |
| Own goal | -2 |
| Bonus (admin picks 3 per match) | 3 / 2 / 1 |

- Captain ×2. Vice-captain auto-applies if captain plays 0 minutes.
- Auto-substitutions after GW finishes: bench order, formation must stay legal.

### Transfers
- Unlimited free before season starts (and while Wildcard active)
- 1 free transfer per GW after that, bank up to 5
- Extra transfers: -4 points each
- Static prices v1 (admin sets/adjusts); `purchase_price` stored per pick so dynamic pricing + sell-price rules can be added later without migration

### Gameweeks
- Admin creates GWs and assigns fixtures with kickoff datetimes
- Deadline auto-computed = first kickoff − 90 min (offset in settings)
- Lifecycle: `upcoming → locked (deadline passed) → finished (admin finalizes → points calculated, auto-subs applied, ranks updated)`

### Leagues
- Overall league: every team auto-joined
- Private classic leagues: create → invite code → join; ranked by total points
- H2H: v2

## 5. Pages

| Route | Page | Notes |
|---|---|---|
| `/login`, `/register`, `/reset-password` | Auth | Email+password, Google, Spanish-first |
| `/onboarding` | Onboarding | Welcome/rules overview → team name + favorite club → 15-man squad within budget → starting XI on pitch → captain/vice on pitch |
| `/home` | Dashboard | GW points, overall rank, deadline countdown, next fixtures, league summary |
| `/team` | My team | Pitch view, set lineup/captain/bench order, view GW points per player |
| `/transfers` | Transfers | Player list with filters, in/out, budget bar, free transfers + hit cost preview |
| `/leagues` | Leagues | My leagues, create/join with code, standings tables |
| `/matches` | Matches | Fixtures + results by GW, match detail with player stats |
| `/more` | More | Profile, rules, language, logout, contact |
| `/admin` | Admin panel | Role-gated: clubs, players, fixtures, gameweeks, match stat entry, bonus picks, league settings, finalize GW |

## 6. Database Schema (Drizzle → Supabase Postgres)

**Identity:** `profiles` (extends auth.users: display_name, locale, is_admin, favorite_club_id)

**League data (admin-managed):**
- `competitions` (LDF…) → `seasons` → `clubs` (name, short_name, colors, badge) → `players` (club, position GK/DEF/MID/FWD, name, price, status: available/injured/suspended)
- `gameweeks` (season, number, deadline, status) → `fixtures` (gameweek, home/away club, kickoff, score, status)
- `player_match_stats` (fixture × player: minutes, goals, assists, clean_sheet, saves, pens_saved/missed, goals_conceded, yellow/red, own_goals, bonus_points) — points computed from `scoring_rules`
- `scoring_rules` (season, event_key, position, points) — table-driven scoring
- `game_settings` (season: budget, squad_size, per-position counts, max_per_club, free transfers bank limit, hit cost, deadline offset, chips enabled)

**Fantasy:**
- `fantasy_teams` (user, season, name, budget remaining, total_points, overall_rank)
- `squad_picks` (fantasy_team × player, purchase_price) — current squad
- `gameweek_lineups` (fantasy_team × gameweek: 15 picks with position 1–15, is_captain, is_vice, points snapshot) — frozen at deadline
- `transfers` (fantasy_team, gameweek, player_in, player_out, was_free, points_cost)
- `chip_plays` (fantasy_team, gameweek, chip type)
- `mini_leagues` (name, invite_code, admin) + `mini_league_members`

RLS: users read public game data + write only their own fantasy rows; admin role for league data writes.

## 7. Build Order

1. ✅ Scaffold (Next.js + Tailwind + shadcn/ui + fonts + i18n + Supabase wiring)
2. ✅ Auth — login / register / reset, Google OAuth, protected routes
3. ✅ Schema + seed — 18 tables in Supabase, sample LDF data, RLS deny-all (data flows through server-side Drizzle)
4. ✅ Onboarding — 5 steps: welcome/how-to-play, identity (team name + favorite club), squad picker (auto-pick, budget, quotas, max/club), starting XI on pitch view (tap-to-swap, flexible formations, bench order), captain + vice on pitch view
5. ✅ Home — dashboard (stats tiles, deadline countdown, fixtures) + app shell (sidebar desktop / bottom tabs + top bar mobile), stub pages for team/transfers/leagues/matches, working More page (profile, sign-out)
6. ✅ Team page — saved lineup on pitch view, tap player → bottom-sheet modal (photo, specs, switch / captain / vice), FLIP swap animation, player cards with photo + club badge + points-or-fixture line, dirty-state save bar, server-validated save to `lineup_picks`, read-only when no upcoming gameweek
7. ✅ Transfers — same pitch view; tap player → transfer sheet → position-filtered market list (budget/club-limit blocks, search) → review sheet (out→in pairs, free transfers, hit cost, bank after) → confirm; pre-season unlimited free transfers; squad picks, bank, free transfers and upcoming lineup picks updated transactionally
8. ✅ Admin panel — `/admin` (role-gated via `profiles.is_admin`, link in Más): clubs CRUD, players CRUD (filters, photo URL), gameweeks + fixtures CRUD (AST datetimes, auto-deadline recompute), match result entry (per-player stats grid, auto clean-sheet/conceded from score, table-driven point computation, admin bonus picks 3/2/1), game settings editor (all rules). RLS now declared in Drizzle schema (`.enableRLS()`) so pushes can't strip it. Image uploads to Supabase Storage (`media` bucket, public read, admin-only writes via `public.is_admin()` security-definer); scoring rules editor (`/admin/scoring`); skeleton `loading.tsx` on all routes.
9. ✅ Gameweek engine — `lib/game/engine.ts` (pure: FPL auto-subs incl. bench-must-play + formation guard, captain ×2 with vice fallback) + `lib/game/finalize.ts` (orchestration: per-pick points, lineup totals net of hits, team totals, global ranks, free-transfer bank +1 capped, lineup rollover to next GW, status finished). "Finalizar jornada" button in admin gameweeks (guards: deadline passed, all fixtures entered, not already finished). Dev scripts: simulate-gw / run-finalize / verify-finalize / reset-gw.
10. ✅ Leagues — overall global standings (live rank, "me" highlighted, GW+total cols) + private leagues: create (6-char invite code), join by code, leave; `/leagues` hub, `/leagues/overall`, `/leagues/[id]` detail with copyable code. `lib/game/leagues.ts` standings queries. Standings names link to `/managers/[teamId]` — read-only rival squad scoped to the latest STARTED gameweek (live points if in play, finalized otherwise); never reveals picks for a gameweek whose deadline hasn't passed (pre-season → hidden message).
11. ✅ Matches — `/matches` fixtures/results browser by gameweek (pager through all season GWs, scores or kickoff times, status badge) + `/matches/[fixtureId]` detail (scoreboard with crests, per-player stats grouped by club, event chips G/A/CS/saves/cards/bonus, sorted by points). Shared `ClubCrest` (badge image or color initials); fixture queries now carry badge URLs. **More** page already done in step 5.
12. ✅ Polish + PWA — installable manifest (`app/manifest.ts`, standalone, theme `#0f0f23`, start `/home`), branded icons (SVG favicon/PWA + code-generated apple PNG via `next/og`), theme-color + apple-web-app meta + metadataBase, branded bilingual 404 (`app/not-found.tsx`). Loading skeletons (step 8) + empty states already in place. Mobile evaluation below.

## 7b. Mobile App Evaluation (decided after step 12)

App is now an installable **PWA**: Add to Home Screen on Android/iOS gives a standalone, themed, full-screen app — $0, instant updates, works today. Ship this first.

Go native only when a concrete need appears:
- **Reliable push notifications** (deadline reminders, price/points alerts) — iOS web push is limited/unreliable.
- **App Store / Play Store presence** for discovery + trust.
- Deeper native features (widgets, richer offline).

When that time comes, recommended path: **Capacitor** wraps the existing Next.js app into native iOS/Android shells with the least rework (reuse 100% of the current UI) and adds native push. A full **Expo / React Native** rewrite is only worth it if a truly native feel is required — it would reuse the Supabase backend, types, and `lib/game/*` pure logic, but the entire UI layer would be rebuilt. Default: PWA now, Capacitor wrapper when push/stores are needed.

## 8. Open Items (revisit later)

- Real LDF data: club list, player lists, current season fixtures — needed before launch (admin enters)
- App name + logo (placeholder "Fantasy LDF", one constant)
- v2: H2H leagues, more chips (Bench Boost, Triple Captain, Free Hit), dynamic prices, push notifications, mobile app
