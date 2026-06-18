/**
 * Pure starting-lineup rules, shared by the client (interactive pitch) and
 * the server (authoritative validation). No I/O here.
 *
 * A lineup is `starterIds` (startingSize players, exactly 1 GK, formation
 * minimums respected) plus `benchIds` ordered: index 0 = backup GK, the rest
 * are outfield substitutes in priority order.
 */

import {
  POSITION_ORDER,
  countByPosition,
  type PickablePlayer,
  type SquadSettings,
} from "./squad";

export type LineupState = {
  starterIds: string[];
  benchIds: string[];
};

export type SwapError = "swap_gk" | "swap_formation";

export type SwapResult =
  | { state: LineupState; error?: never }
  | { error: SwapError; state?: never }
  | { state?: never; error?: never }; // no-op (e.g. tapping two starters)

function formationLegal(
  starters: PickablePlayer[],
  settings: SquadSettings
): boolean {
  const counts = countByPosition(starters);
  return (
    counts.GK === 1 &&
    counts.DEF >= settings.minDef &&
    counts.MID >= settings.minMid &&
    counts.FWD >= settings.minFwd
  );
}

/**
 * Attempt to swap players `aId` and `bId` (either may be starter or bench).
 * Returns the new state, a swap error, or `{}` when the pair is a no-op.
 */
export function trySwap(
  state: LineupState,
  aId: string,
  bId: string,
  byId: Map<string, PickablePlayer>,
  settings: SquadSettings
): SwapResult {
  const a = byId.get(aId);
  const b = byId.get(bId);
  if (!a || !b || aId === bId) return {};

  const aStarter = state.starterIds.includes(aId);
  const bStarter = state.starterIds.includes(bId);

  if (aStarter && bStarter) return {};

  // Both on bench: reorder outfield substitutes; the GK slot is fixed.
  if (!aStarter && !bStarter) {
    if (a.position === "GK" || b.position === "GK") return {};
    const benchIds = [...state.benchIds];
    const ai = benchIds.indexOf(aId);
    const bi = benchIds.indexOf(bId);
    [benchIds[ai], benchIds[bi]] = [benchIds[bi], benchIds[ai]];
    return { state: { starterIds: state.starterIds, benchIds } };
  }

  // Starter ↔ bench
  const starter = aStarter ? a : b;
  const benched = aStarter ? b : a;

  const aIsGk = a.position === "GK";
  const bIsGk = b.position === "GK";
  if (aIsGk !== bIsGk) return { error: "swap_gk" };

  const nextStarters = state.starterIds
    .filter((id) => id !== starter.id)
    .concat(benched.id);

  if (
    !formationLegal(
      nextStarters.map((id) => byId.get(id)!),
      settings
    )
  ) {
    return { error: "swap_formation" };
  }

  const benchIds = state.benchIds.map((id) =>
    id === benched.id ? starter.id : id
  );

  return { state: { starterIds: nextStarters, benchIds } };
}

export type LineupValidationError = "lineup_invalid" | "captain_invalid";

/** Authoritative full-lineup validation (server-side). */
export function validateLineup(input: {
  squad: PickablePlayer[];
  starterIds: string[];
  benchIds: string[];
  captainId: string;
  viceId: string;
  settings: SquadSettings;
}): LineupValidationError | null {
  const { squad, starterIds, benchIds, captainId, viceId, settings } = input;
  const benchSize = settings.squadSize - settings.startingSize;

  if (
    starterIds.length !== settings.startingSize ||
    benchIds.length !== benchSize
  ) {
    return "lineup_invalid";
  }

  const all = [...starterIds, ...benchIds];
  const squadIds = new Set(squad.map((p) => p.id));
  if (
    new Set(all).size !== settings.squadSize ||
    !all.every((id) => squadIds.has(id))
  ) {
    return "lineup_invalid";
  }

  const byId = new Map(squad.map((p) => [p.id, p]));
  const starters = starterIds.map((id) => byId.get(id)!);
  if (!formationLegal(starters, settings)) return "lineup_invalid";

  // Bench slot 0 must be the backup goalkeeper; the rest must be outfield.
  const bench = benchIds.map((id) => byId.get(id)!);
  if (bench[0]?.position !== "GK") return "lineup_invalid";
  if (bench.slice(1).some((p) => p.position === "GK")) return "lineup_invalid";

  if (
    captainId === viceId ||
    !starterIds.includes(captainId) ||
    !starterIds.includes(viceId)
  ) {
    return "captain_invalid";
  }

  return null;
}

/** Display order for pitch rows, top to bottom. */
export const PITCH_LINES = POSITION_ORDER;

/**
 * DB slot order: starters sorted GK→DEF→MID→FWD fill slots 1–N, bench
 * keeps the given priority order in the remaining slots.
 */
export function orderLineupForSlots(
  state: LineupState,
  byId: Map<string, PickablePlayer>
): string[] {
  const orderedStarters = [...state.starterIds].sort(
    (a, b) =>
      POSITION_ORDER.indexOf(byId.get(a)!.position) -
      POSITION_ORDER.indexOf(byId.get(b)!.position)
  );
  return [...orderedStarters, ...state.benchIds];
}
