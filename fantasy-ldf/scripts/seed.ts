/**
 * Seed script — SAMPLE development data.
 *
 * Club names are real LDF clubs, but rosters, prices and fixtures are
 * placeholders so the app is usable during development. Real data gets
 * entered/corrected through the admin panel before launch.
 *
 * Run: npm run db:seed
 * Idempotent: aborts if the competition already exists.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

const SAMPLE_CLUBS = [
  { name: "Cibao FC", shortName: "CIB", primaryColor: "#F58220", secondaryColor: "#000000" },
  { name: "Atlético Pantoja", shortName: "PAN", primaryColor: "#1B5E20", secondaryColor: "#FFD600" },
  { name: "Moca FC", shortName: "MOC", primaryColor: "#7B1FA2", secondaryColor: "#FFFFFF" },
  { name: "Atlético Vega Real", shortName: "AVR", primaryColor: "#C62828", secondaryColor: "#FFFFFF" },
  { name: "Jarabacoa FC", shortName: "JAR", primaryColor: "#2E7D32", secondaryColor: "#FFFFFF" },
  { name: "O&M FC", shortName: "OYM", primaryColor: "#0D47A1", secondaryColor: "#FFFFFF" },
  { name: "Atlántico FC", shortName: "ATL", primaryColor: "#01579B", secondaryColor: "#FFC107" },
  { name: "Delfines del Este FC", shortName: "DEL", primaryColor: "#006064", secondaryColor: "#FFFFFF" },
];

const FIRST_NAMES = [
  "Juan", "Luis", "Carlos", "José", "Miguel", "Rafael", "Pedro", "Ángel",
  "Francisco", "Ramón", "Domingo", "Antonio", "Manuel", "Edward", "Jeison",
  "Yeferson", "Brayan", "Kelvin", "Junior", "Erick",
];

const LAST_NAMES = [
  "Rodríguez", "Pérez", "Martínez", "García", "Hernández", "González",
  "Santana", "Reyes", "Núñez", "Castillo", "Jiménez", "Vásquez", "Rosario",
  "Polanco", "Guzmán", "Peña", "Mejía", "De la Cruz", "Báez", "Féliz",
];

// 18 per club: 2 GK, 6 DEF, 6 MID, 4 FWD
const ROSTER: Array<{ position: "GK" | "DEF" | "MID" | "FWD"; count: number; priceMin: number; priceMax: number }> = [
  { position: "GK", count: 2, priceMin: 40, priceMax: 50 },
  { position: "DEF", count: 6, priceMin: 40, priceMax: 60 },
  { position: "MID", count: 6, priceMin: 45, priceMax: 80 },
  { position: "FWD", count: 4, priceMin: 45, priceMax: 90 },
];

// Deterministic pseudo-random so re-creating the DB gives identical data.
function pseudoRandom(seedValue: number) {
  const x = Math.sin(seedValue) * 10000;
  return x - Math.floor(x);
}

const SCORING_RULES: Array<{
  eventKey: string;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
  points: number;
}> = [
  { eventKey: "minutes_lt_60", position: null, points: 1 },
  { eventKey: "minutes_gte_60", position: null, points: 2 },
  { eventKey: "goal", position: "GK", points: 6 },
  { eventKey: "goal", position: "DEF", points: 6 },
  { eventKey: "goal", position: "MID", points: 5 },
  { eventKey: "goal", position: "FWD", points: 4 },
  { eventKey: "assist", position: null, points: 3 },
  { eventKey: "clean_sheet", position: "GK", points: 4 },
  { eventKey: "clean_sheet", position: "DEF", points: 4 },
  { eventKey: "clean_sheet", position: "MID", points: 1 },
  { eventKey: "saves_per_3", position: "GK", points: 1 },
  { eventKey: "penalty_save", position: "GK", points: 5 },
  { eventKey: "penalty_miss", position: null, points: -2 },
  { eventKey: "goals_conceded_per_2", position: "GK", points: -1 },
  { eventKey: "goals_conceded_per_2", position: "DEF", points: -1 },
  { eventKey: "yellow_card", position: null, points: -1 },
  { eventKey: "red_card", position: null, points: -3 },
  { eventKey: "own_goal", position: null, points: -2 },
];

// Tables exposed through Supabase's REST API. All data access in this app goes
// through server-side Drizzle, so we enable RLS with NO policies: the anon key
// can authenticate users but cannot read or write any table directly.
const RLS_TABLES = [
  "profiles", "competitions", "seasons", "clubs", "players", "gameweeks",
  "fixtures", "player_match_stats", "scoring_rules", "game_settings",
  "fantasy_teams", "squad_picks", "gameweek_lineups", "lineup_picks",
  "transfers", "chip_plays", "mini_leagues", "mini_league_members",
];

async function main() {
  const existing = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.shortName, "LDF"));

  if (existing.length > 0) {
    console.log("Already seeded (competition LDF exists). Nothing to do.");
    return;
  }

  console.log("Seeding competition + season...");
  const [competition] = await db
    .insert(schema.competitions)
    .values({
      name: "Liga Dominicana de Fútbol",
      shortName: "LDF",
      country: "DO",
    })
    .returning();

  const [season] = await db
    .insert(schema.seasons)
    .values({
      competitionId: competition.id,
      name: "2026",
      isActive: true,
    })
    .returning();

  await db.insert(schema.gameSettings).values({ seasonId: season.id });

  console.log("Seeding scoring rules...");
  await db.insert(schema.scoringRules).values(
    SCORING_RULES.map((rule) => ({
      seasonId: season.id,
      eventKey: rule.eventKey,
      position: rule.position,
      points: rule.points,
    }))
  );

  console.log("Seeding clubs + sample players...");
  const clubRows = await db
    .insert(schema.clubs)
    .values(
      SAMPLE_CLUBS.map((c) => ({ ...c, competitionId: competition.id }))
    )
    .returning();

  let nameIndex = 0;
  const playerValues = [];
  for (const club of clubRows) {
    for (const group of ROSTER) {
      for (let i = 0; i < group.count; i++) {
        const firstName = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
        const lastName =
          LAST_NAMES[Math.floor(nameIndex / FIRST_NAMES.length + nameIndex) % LAST_NAMES.length];
        const spread = group.priceMax - group.priceMin;
        const price =
          group.priceMin + Math.round(pseudoRandom(nameIndex + 1) * spread);
        playerValues.push({
          clubId: club.id,
          firstName,
          lastName,
          position: group.position,
          price,
        });
        nameIndex++;
      }
    }
  }
  await db.insert(schema.players).values(playerValues);

  console.log("Seeding gameweek 1 + fixtures...");
  // Next Saturday 19:00 local as a believable placeholder kickoff
  const kickoff = new Date();
  kickoff.setDate(kickoff.getDate() + ((6 - kickoff.getDay() + 7) % 7 || 7));
  kickoff.setHours(19, 0, 0, 0);
  const deadline = new Date(kickoff.getTime() - 90 * 60 * 1000);

  const [gameweek] = await db
    .insert(schema.gameweeks)
    .values({
      seasonId: season.id,
      number: 1,
      deadline,
      status: "upcoming",
    })
    .returning();

  const fixtureValues = [];
  for (let i = 0; i < clubRows.length; i += 2) {
    // Stagger: two matches Saturday, rest Sunday
    const matchKickoff = new Date(kickoff.getTime());
    if (i >= 4) matchKickoff.setDate(matchKickoff.getDate() + 1);
    if (i % 4 === 2) matchKickoff.setHours(21, 0, 0, 0);
    fixtureValues.push({
      gameweekId: gameweek.id,
      homeClubId: clubRows[i].id,
      awayClubId: clubRows[i + 1].id,
      kickoff: matchKickoff,
    });
  }
  await db.insert(schema.fixtures).values(fixtureValues);

  console.log("Enabling row level security (deny-all via REST API)...");
  for (const table of RLS_TABLES) {
    await db.execute(
      sql.raw(`alter table "${table}" enable row level security`)
    );
  }

  console.log(
    `Done: ${clubRows.length} clubs, ${playerValues.length} players, ` +
      `${SCORING_RULES.length} scoring rules, GW1 with ${fixtureValues.length} fixtures.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
