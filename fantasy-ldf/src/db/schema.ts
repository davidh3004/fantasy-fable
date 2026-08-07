import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All money values (prices, budgets) are stored as integers in tenths,
 * FPL-style: 1000 = $100.0m, 45 = $4.5m. Avoids float rounding entirely.
 */

export const playerPosition = pgEnum("player_position", [
  "GK",
  "DEF",
  "MID",
  "FWD",
]);

export const playerStatus = pgEnum("player_status", [
  "available",
  "injured",
  "suspended",
  "unavailable",
]);

export const gameweekStatus = pgEnum("gameweek_status", [
  "upcoming",
  "locked",
  "finished",
]);

export const fixtureStatus = pgEnum("fixture_status", [
  "scheduled",
  "live",
  "finished",
]);

export const chipType = pgEnum("chip_type", ["wildcard"]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

// Mirrors auth.users (same uuid). Created by the app during onboarding.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  locale: text("locale").notNull().default("es"),
  isAdmin: boolean("is_admin").notNull().default(false),
  favoriteClubId: uuid("favorite_club_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

// ---------------------------------------------------------------------------
// League data (admin-managed)
// ---------------------------------------------------------------------------

export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  badgeUrl: text("badge_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .notNull()
    .references(() => clubs.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: playerPosition("position").notNull(),
  price: integer("price").notNull(), // tenths: 45 = 4.5
  status: playerStatus("status").notNull().default("available"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  },
  (t) => [index("players_club_idx").on(t.clubId)]
).enableRLS();

export const gameweeks = pgTable(
  "gameweeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    number: smallint("number").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    status: gameweekStatus("status").notNull().default("upcoming"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("gameweeks_season_number_idx").on(t.seasonId, t.number)]
).enableRLS();

export const fixtures = pgTable("fixtures", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameweekId: uuid("gameweek_id")
    .notNull()
    .references(() => gameweeks.id),
  homeClubId: uuid("home_club_id")
    .notNull()
    .references(() => clubs.id),
  awayClubId: uuid("away_club_id")
    .notNull()
    .references(() => clubs.id),
  kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
  homeScore: smallint("home_score"),
  awayScore: smallint("away_score"),
  status: fixtureStatus("status").notNull().default("scheduled"),
  },
  (t) => [index("fixtures_gameweek_idx").on(t.gameweekId)]
).enableRLS();

export const playerMatchStats = pgTable(
  "player_match_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    minutes: smallint("minutes").notNull().default(0),
    goals: smallint("goals").notNull().default(0),
    assists: smallint("assists").notNull().default(0),
    cleanSheet: boolean("clean_sheet").notNull().default(false),
    saves: smallint("saves").notNull().default(0),
    penaltiesSaved: smallint("penalties_saved").notNull().default(0),
    penaltiesMissed: smallint("penalties_missed").notNull().default(0),
    goalsConceded: smallint("goals_conceded").notNull().default(0),
    yellowCards: smallint("yellow_cards").notNull().default(0),
    redCards: smallint("red_cards").notNull().default(0),
    ownGoals: smallint("own_goals").notNull().default(0),
    bonusPoints: smallint("bonus_points").notNull().default(0), // 0–3, admin-picked
    points: smallint("points").notNull().default(0), // computed snapshot
    // Live-console bookkeeping. `minutes` above stays the value the scoring
    // engine reads; it's recomputed from these on every save.
    started: boolean("started").notNull().default(false),
    onMinute: smallint("on_minute"), // entered the pitch (0 for starters)
    offMinute: smallint("off_minute"), // left the pitch; null = still on
  },
  (t) => [
    uniqueIndex("player_match_stats_fixture_player_idx").on(
      t.fixtureId,
      t.playerId
    ),
  ]
).enableRLS();

// Table-driven scoring: position NULL = applies to every position.
export const scoringRules = pgTable(
  "scoring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    eventKey: text("event_key").notNull(),
    position: playerPosition("position"),
    points: smallint("points").notNull(),
  },
  (t) => [
    uniqueIndex("scoring_rules_season_event_position_idx").on(
      t.seasonId,
      t.eventKey,
      t.position
    ),
  ]
).enableRLS();

// One row per season. Every game number lives here, not in code.
export const gameSettings = pgTable("game_settings", {
  seasonId: uuid("season_id")
    .primaryKey()
    .references(() => seasons.id),
  budget: integer("budget").notNull().default(1000), // tenths
  squadSize: smallint("squad_size").notNull().default(15),
  gkCount: smallint("gk_count").notNull().default(2),
  defCount: smallint("def_count").notNull().default(5),
  midCount: smallint("mid_count").notNull().default(5),
  fwdCount: smallint("fwd_count").notNull().default(3),
  startingSize: smallint("starting_size").notNull().default(11),
  minDef: smallint("min_def").notNull().default(3),
  minMid: smallint("min_mid").notNull().default(2),
  minFwd: smallint("min_fwd").notNull().default(1),
  maxPerClub: smallint("max_per_club").notNull().default(3),
  freeTransfersPerGw: smallint("free_transfers_per_gw").notNull().default(1),
  maxBankedTransfers: smallint("max_banked_transfers").notNull().default(5),
  transferHitCost: smallint("transfer_hit_cost").notNull().default(4),
  deadlineOffsetMinutes: smallint("deadline_offset_minutes")
    .notNull()
    .default(90),
  wildcardsPerSeason: smallint("wildcards_per_season").notNull().default(2),
}).enableRLS();

// ---------------------------------------------------------------------------
// Fantasy (user-managed)
// ---------------------------------------------------------------------------

export const fantasyTeams = pgTable(
  "fantasy_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    name: text("name").notNull(),
    budget: integer("budget").notNull(), // remaining bank, tenths
    totalPoints: integer("total_points").notNull().default(0),
    overallRank: integer("overall_rank"),
    // Rank before the most recent finalize; drives the movement arrow.
    previousOverallRank: integer("previous_overall_rank"),
    freeTransfers: smallint("free_transfers").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("fantasy_teams_user_season_idx").on(t.userId, t.seasonId),
    // Standings/ranking scan the season's teams ordered by points.
    index("fantasy_teams_season_points_idx").on(t.seasonId, t.totalPoints),
  ]
).enableRLS();

// Current squad (15 players). History lives in lineup_picks per gameweek.
export const squadPicks = pgTable(
  "squad_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fantasyTeamId: uuid("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    purchasePrice: integer("purchase_price").notNull(), // tenths, for future dynamic pricing
  },
  (t) => [
    uniqueIndex("squad_picks_team_player_idx").on(t.fantasyTeamId, t.playerId),
  ]
).enableRLS();

// Frozen at deadline; points filled when the gameweek is finalized.
export const gameweekLineups = pgTable(
  "gameweek_lineups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fantasyTeamId: uuid("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id),
    gameweekId: uuid("gameweek_id")
      .notNull()
      .references(() => gameweeks.id),
    points: integer("points"),
    transfersCost: smallint("transfers_cost").notNull().default(0),
    chip: chipType("chip"),
  },
  (t) => [
    uniqueIndex("gameweek_lineups_team_gw_idx").on(t.fantasyTeamId, t.gameweekId),
    // Finalize + live standings look up every lineup of one gameweek.
    index("gameweek_lineups_gameweek_idx").on(t.gameweekId),
  ]
).enableRLS();

// Slots 1–11 = starters (in formation order), 12–15 = bench order.
export const lineupPicks = pgTable(
  "lineup_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lineupId: uuid("lineup_id")
      .notNull()
      .references(() => gameweekLineups.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    slot: smallint("slot").notNull(),
    isCaptain: boolean("is_captain").notNull().default(false),
    isVice: boolean("is_vice").notNull().default(false),
    points: smallint("points"), // snapshot after finalization (incl. captain multiplier)
  },
  (t) => [
    uniqueIndex("lineup_picks_lineup_slot_idx").on(t.lineupId, t.slot),
    uniqueIndex("lineup_picks_lineup_player_idx").on(t.lineupId, t.playerId),
  ]
).enableRLS();

export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  fantasyTeamId: uuid("fantasy_team_id")
    .notNull()
    .references(() => fantasyTeams.id),
  gameweekId: uuid("gameweek_id")
    .notNull()
    .references(() => gameweeks.id),
  playerInId: uuid("player_in_id")
    .notNull()
    .references(() => players.id),
  playerOutId: uuid("player_out_id")
    .notNull()
    .references(() => players.id),
  wasFree: boolean("was_free").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const chipPlays = pgTable(
  "chip_plays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fantasyTeamId: uuid("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id),
    gameweekId: uuid("gameweek_id")
      .notNull()
      .references(() => gameweeks.id),
    chip: chipType("chip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("chip_plays_team_gw_idx").on(t.fantasyTeamId, t.gameweekId),
  ]
).enableRLS();

// ---------------------------------------------------------------------------
// Mini-leagues
// ---------------------------------------------------------------------------

export const miniLeagues = pgTable("mini_leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const miniLeagueMembers = pgTable(
  "mini_league_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => miniLeagues.id),
    fantasyTeamId: uuid("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("mini_league_members_league_team_idx").on(
      t.leagueId,
      t.fantasyTeamId
    ),
    // "My leagues" + leave-league look up membership by team.
    index("mini_league_members_team_idx").on(t.fantasyTeamId),
  ]
).enableRLS();
