/** Gacha rolls. Pure — RNG is injected so tests are deterministic. */

import { GACHA, type Rarity } from "./config.ts";
import { GACHA_POOL, charactersByRarity } from "./characters/registry.ts";

export type Rng = () => number;

export interface PullOutcome {
  rarity: Rarity;
  /** Newly obtained character id, or null when the roll was a dupe / empty tier. */
  characterId: string | null;
  dupe: boolean;
  refund: number;
  /** Pity counter after this pull. */
  pity: number;
}

/** Pick a rarity, honoring the hard 5★ pity ceiling. */
export function rollRarity(pity: number, rng: Rng): Rarity {
  if (pity + 1 >= GACHA.pity5) return 5;
  const r = rng();
  let acc = 0;
  for (const rarity of [3, 4, 5] as Rarity[]) {
    acc += GACHA.rates[rarity];
    if (r < acc) return rarity;
  }
  return 5; // rounding safety
}

/**
 * Perform one pull against `pool` (default = the standard gacha pool),
 * given the currently owned character ids and pity counter.
 */
export function pull(
  ownedIds: string[],
  pity: number,
  rng: Rng,
  pool: string[] = GACHA_POOL,
): PullOutcome {
  const rarity = rollRarity(pity, rng);
  const nextPity = rarity === 5 ? 0 : pity + 1;

  const owned = new Set(ownedIds);
  const tier = charactersByRarity(rarity, pool);
  const unowned = tier.filter((id) => !owned.has(id));

  if (unowned.length > 0) {
    const idx = Math.min(
      unowned.length - 1,
      Math.floor(rng() * unowned.length),
    );
    return {
      rarity,
      characterId: unowned[idx],
      dupe: false,
      refund: 0,
      pity: nextPity,
    };
  }

  // Nothing new to give at this tier.
  const emptyTier = tier.length === 0;
  const refund = emptyTier
    ? GACHA.emptyTierRefund[rarity]
    : GACHA.dupeRefund[rarity];
  return {
    rarity,
    characterId: null,
    dupe: !emptyTier,
    refund,
    pity: nextPity,
  };
}
