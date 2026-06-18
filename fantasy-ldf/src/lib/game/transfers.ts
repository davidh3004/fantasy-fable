/**
 * Pure transfer rules, shared by the client (interactive market) and the
 * server (authoritative validation). No I/O here.
 *
 * v1 economics: static prices — players sell for their current price, and
 * incoming players are bought at their current price.
 */

import type { PickablePlayer, SquadSettings } from "./squad";

export type TransferPair = { outId: string; inId: string };

export type TransferBatchError =
  | "invalid"
  | "position_mismatch"
  | "club_limit"
  | "budget";

/** New squad after applying pairs, or null when structurally invalid. */
export function applyTransfersToSquad<T extends PickablePlayer>(
  squad: T[],
  pairs: TransferPair[],
  poolById: Map<string, T>
): T[] | null {
  const squadIds = new Set(squad.map((p) => p.id));
  const outIds = pairs.map((p) => p.outId);
  const inIds = pairs.map((p) => p.inId);

  if (
    new Set(outIds).size !== outIds.length ||
    new Set(inIds).size !== inIds.length
  ) {
    return null;
  }
  for (const pair of pairs) {
    const incoming = poolById.get(pair.inId);
    if (!incoming) return null;
    if (!squadIds.has(pair.outId)) return null;
    if (squadIds.has(pair.inId)) return null;
  }

  const outSet = new Set(outIds);
  return [
    ...squad.filter((p) => !outSet.has(p.id)),
    ...inIds.map((id) => poolById.get(id)!),
  ];
}

/** Bank (tenths) after selling the outs and buying the ins. */
export function bankAfterTransfers(
  bank: number,
  pairs: TransferPair[],
  poolById: Map<string, PickablePlayer>
): number {
  let result = bank;
  for (const pair of pairs) {
    result += poolById.get(pair.outId)?.price ?? 0;
    result -= poolById.get(pair.inId)?.price ?? 0;
  }
  return result;
}

export function validateTransferBatch(input: {
  squad: PickablePlayer[];
  pairs: TransferPair[];
  poolById: Map<string, PickablePlayer>;
  bank: number;
  settings: SquadSettings;
}): TransferBatchError | null {
  const { squad, pairs, poolById, bank, settings } = input;

  const newSquad = applyTransfersToSquad(squad, pairs, poolById);
  if (!newSquad) return "invalid";

  for (const pair of pairs) {
    const outgoing = poolById.get(pair.outId);
    const incoming = poolById.get(pair.inId);
    if (!outgoing || !incoming) return "invalid";
    if (outgoing.position !== incoming.position) return "position_mismatch";
  }

  const perClub = new Map<string, number>();
  for (const player of newSquad) {
    const count = (perClub.get(player.clubId) ?? 0) + 1;
    if (count > settings.maxPerClub) return "club_limit";
    perClub.set(player.clubId, count);
  }

  if (bankAfterTransfers(bank, pairs, poolById) < 0) return "budget";

  return null;
}

export type TransferCost = {
  freeUsed: number;
  hits: number;
  points: number;
};

/** How many transfers are free vs. paid, and the points cost. */
export function transferCost(input: {
  count: number;
  freeTransfers: number;
  hitCost: number;
  preSeason: boolean;
}): TransferCost {
  const { count, freeTransfers, hitCost, preSeason } = input;
  if (preSeason) {
    return { freeUsed: count, hits: 0, points: 0 };
  }
  const freeUsed = Math.min(count, freeTransfers);
  const hits = count - freeUsed;
  return { freeUsed, hits, points: hits * hitCost };
}
