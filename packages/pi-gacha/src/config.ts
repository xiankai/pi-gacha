/**
 * Balance constants. All tunable game numbers live here so M7 balancing is a
 * single-file pass. Pure data — no logic, no IO.
 */

export const SAVE_VERSION = 1;

/** XP awarded per turn, by contribution. */
export const XP = {
	perOutputToken: 1 / 50, // 50 output tokens = 1 xp
	perToolCall: 5,
	perEdit: 10,
	perTestPassed: 50,
	/** xp needed to go from `level` to `level+1`. */
	toNext: (level: number): number => Math.round(100 * level ** 1.5),
} as const;

/** Currency ("Cores"). */
export const ECONOMY = {
	coresPerOutputToken: 1 / 100, // 100 output tokens = 1 Core
	coresPerToolSuccess: 1,
	coresPerTestPassed: 10,
	/** Cores granted per commander level gained. */
	coresPerLevelUp: 50,
} as const;

/** Gacha. */
export const GACHA = {
	pullCost: 300,
	/** Probability of each rarity on a normal (non-pity) pull. Must sum to 1. */
	rates: { 3: 0.75, 4: 0.2, 5: 0.05 } as Record<Rarity, number>,
	/** Pulls without a 5★ that force a guaranteed 5★. */
	pity5: 50,
	/** Cores refunded when a pull yields a character you already own (a dupe). */
	dupeRefund: { 3: 20, 4: 60, 5: 150 } as Record<Rarity, number>,
	/** Cores granted when a rarity tier has no unowned character left to give. */
	emptyTierRefund: { 3: 20, 4: 60, 5: 150 } as Record<Rarity, number>,
} as const;

/** Idle / incremental. */
export const IDLE = {
	baseCoresPerHour: 30,
	/** Max Cores that can accrue while away, before upgrades. */
	capCores: 480, // ~16h at base rate
} as const;

/** Daily check-in rewards. */
export const CHECK_IN = {
	/** Base Cores for checking in. */
	baseCores: 10,
	/** Extra Cores per consecutive day (streak). */
	streakBonusPerDay: 5,
	/** Cap on the streak bonus (applied at 30 days of bonus). */
	maxStreakBonus: 150,
} as const;

/** Upgrades: id -> per-level effect. Level 0 = not purchased. */
export const UPGRADES = {
	overclock: {
		name: "Overclock",
		description: "+10% Cores earned from coding, per level.",
		maxLevel: 5,
		cost: (level: number) => 200 * (level + 1),
	},
	neural_boost: {
		name: "Neural Boost",
		description: "+10% XP earned, per level.",
		maxLevel: 5,
		cost: (level: number) => 200 * (level + 1),
	},
	idle_array: {
		name: "Idle Array",
		description: "+50% passive Core accrual rate, per level.",
		maxLevel: 5,
		cost: (level: number) => 300 * (level + 1),
	},
} as const;

export type UpgradeId = keyof typeof UPGRADES;
export type Rarity = 3 | 4 | 5;
