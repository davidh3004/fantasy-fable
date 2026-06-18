/**
 * Pure squad-building rules, shared by client (interactive picker) and
 * server (authoritative validation). No I/O here.
 */

export type Position = "GK" | "DEF" | "MID" | "FWD";

export const POSITION_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];

export type SquadSettings = {
  budget: number; // tenths
  squadSize: number;
  gkCount: number;
  defCount: number;
  midCount: number;
  fwdCount: number;
  maxPerClub: number;
  startingSize: number;
  minDef: number;
  minMid: number;
  minFwd: number;
};

export type PickablePlayer = {
  id: string;
  position: Position;
  price: number; // tenths
  clubId: string;
};

export function positionQuota(
  settings: SquadSettings
): Record<Position, number> {
  return {
    GK: settings.gkCount,
    DEF: settings.defCount,
    MID: settings.midCount,
    FWD: settings.fwdCount,
  };
}

export function squadCost(players: PickablePlayer[]): number {
  return players.reduce((sum, p) => sum + p.price, 0);
}

export function countByPosition(
  players: PickablePlayer[]
): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) counts[p.position]++;
  return counts;
}

export type AddBlock =
  | "already_selected"
  | "squad_full"
  | "position_full"
  | "club_limit"
  | "budget";

/** Why `candidate` can't join `selected` right now — or null if it can. */
export function canAdd(
  selected: PickablePlayer[],
  candidate: PickablePlayer,
  settings: SquadSettings
): AddBlock | null {
  if (selected.some((p) => p.id === candidate.id)) return "already_selected";
  if (selected.length >= settings.squadSize) return "squad_full";
  if (
    countByPosition(selected)[candidate.position] >=
    positionQuota(settings)[candidate.position]
  ) {
    return "position_full";
  }
  const clubCount = selected.filter(
    (p) => p.clubId === candidate.clubId
  ).length;
  if (clubCount >= settings.maxPerClub) return "club_limit";
  if (squadCost(selected) + candidate.price > settings.budget) return "budget";
  return null;
}

export type SquadError =
  | "squad_incomplete"
  | "duplicate_players"
  | "position_counts"
  | "club_limit"
  | "budget_exceeded";

/** Full-squad validation. Returns an error key or null when valid. */
export function validateSquad(
  selected: PickablePlayer[],
  settings: SquadSettings
): SquadError | null {
  if (selected.length !== settings.squadSize) return "squad_incomplete";

  if (new Set(selected.map((p) => p.id)).size !== selected.length) {
    return "duplicate_players";
  }

  const counts = countByPosition(selected);
  const quota = positionQuota(settings);
  for (const pos of POSITION_ORDER) {
    if (counts[pos] !== quota[pos]) return "position_counts";
  }

  const perClub = new Map<string, number>();
  for (const p of selected) {
    const count = (perClub.get(p.clubId) ?? 0) + 1;
    if (count > settings.maxPerClub) return "club_limit";
    perClub.set(p.clubId, count);
  }

  if (squadCost(selected) > settings.budget) return "budget_exceeded";

  return null;
}

/**
 * Random-greedy auto pick: fills every quota within budget and club limits.
 * Retries with fresh randomness; returns [] if no valid squad was found.
 */
export function autoPick(
  pool: PickablePlayer[],
  settings: SquadSettings,
  rng: () => number = Math.random
): PickablePlayer[] {
  for (let attempt = 0; attempt < 60; attempt++) {
    const selection: PickablePlayer[] = [];
    let failed = false;

    for (const pos of POSITION_ORDER) {
      const quota = positionQuota(settings)[pos];
      for (let i = 0; i < quota && !failed; i++) {
        const slotsLeftAfter =
          settings.squadSize - selection.length - 1;
        const candidates = pool.filter((p) => {
          if (p.position !== pos) return false;
          if (canAdd(selection, p, settings) !== null) return false;
          // Keep enough budget to fill the remaining slots with cheap players.
          const minRemaining = slotsLeftAfter * cheapestPrice(pool);
          return (
            squadCost(selection) + p.price + minRemaining <= settings.budget
          );
        });
        if (candidates.length === 0) {
          failed = true;
          break;
        }
        selection.push(candidates[Math.floor(rng() * candidates.length)]);
      }
      if (failed) break;
    }

    if (!failed && validateSquad(selection, settings) === null) {
      return selection;
    }
  }
  return [];
}

let cheapestCache: { pool: PickablePlayer[]; value: number } | null = null;
function cheapestPrice(pool: PickablePlayer[]): number {
  if (cheapestCache?.pool === pool) return cheapestCache.value;
  const value = Math.min(...pool.map((p) => p.price));
  cheapestCache = { pool, value };
  return value;
}

/**
 * Default starting lineup from a fresh 15-man squad: 1-4-4-2 by price
 * (most expensive players start). Captain = priciest starter.
 * Slots 1–11 starters, 12–15 bench (12 = backup GK).
 */
export function buildInitialLineup(selected: PickablePlayer[]): {
  starters: PickablePlayer[];
  bench: PickablePlayer[];
  captainId: string;
  viceId: string;
} {
  const byPos = (pos: Position) =>
    selected
      .filter((p) => p.position === pos)
      .sort((a, b) => b.price - a.price);

  const gks = byPos("GK");
  const defs = byPos("DEF");
  const mids = byPos("MID");
  const fwds = byPos("FWD");

  const starters = [
    gks[0],
    ...defs.slice(0, 4),
    ...mids.slice(0, 4),
    ...fwds.slice(0, 2),
  ];
  const bench = [
    gks[1],
    ...[...defs.slice(4), ...mids.slice(4), ...fwds.slice(2)].sort(
      (a, b) => b.price - a.price
    ),
  ];

  const byPrice = [...starters].sort((a, b) => b.price - a.price);

  return {
    starters,
    bench,
    captainId: byPrice[0].id,
    viceId: byPrice[1].id,
  };
}
