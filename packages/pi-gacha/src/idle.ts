/** Idle / incremental passive accrual. Pure. */

import { IDLE, type UpgradeId } from "./config.ts";

export interface IdleReward {
	cores: number;
	hours: number;
}

/**
 * Cores accrued while away for `elapsedMs`. The Idle Array upgrade raises both
 * the rate and the cap by +50% per level.
 */
export function idleCores(elapsedMs: number, upgrades: Record<UpgradeId, number>): IdleReward {
	const hours = Math.max(0, elapsedMs / 3_600_000);
	const boost = 1 + 0.5 * (upgrades?.idle_array ?? 0);
	const rate = IDLE.baseCoresPerHour * boost;
	const cap = IDLE.capCores * boost;
	const cores = Math.min(cap, Math.floor(rate * hours));
	return { cores, hours };
}
