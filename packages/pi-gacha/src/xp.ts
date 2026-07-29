/** XP & leveling. Pure functions over (level, xp). */

import { XP } from "./config.ts";

export interface LevelProgress {
	level: number;
	xp: number; // xp into current level
	xpToNext: number; // xp needed to reach next level
	fraction: number; // 0..1 progress within current level
}

export function progress(level: number, xp: number): LevelProgress {
	const xpToNext = XP.toNext(level);
	return { level, xp, xpToNext, fraction: xpToNext > 0 ? Math.min(1, xp / xpToNext) : 0 };
}

export interface AddXpResult {
	level: number;
	xp: number;
	levelsGained: number;
}

/**
 * Add xp to (level, xp), rolling over as many levels as the amount covers.
 * `xp` is carried as progress within the current level.
 */
export function addXp(level: number, xp: number, amount: number): AddXpResult {
	if (!Number.isFinite(amount) || amount <= 0) {
		return { level, xp, levelsGained: 0 };
	}
	let lvl = level;
	let cur = xp + amount;
	let gained = 0;
	// Guard against pathological loops; levels are bounded in practice.
	let guard = 0;
	while (cur >= XP.toNext(lvl) && guard++ < 100_000) {
		cur -= XP.toNext(lvl);
		lvl += 1;
		gained += 1;
	}
	return { level: lvl, xp: cur, levelsGained: gained };
}
