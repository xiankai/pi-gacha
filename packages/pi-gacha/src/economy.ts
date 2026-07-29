/** Currency, XP-from-activity, efficiency, tk/s. Pure. */

import { ECONOMY, UPGRADES, XP, type UpgradeId } from "./config.ts";
import type { TurnActivity } from "./types.ts";

function upgradeLevel(upgrades: Record<UpgradeId, number>, id: UpgradeId): number {
	return upgrades?.[id] ?? 0;
}

/** Cores earned from a turn, before/after the Overclock multiplier. */
export function coresFromTurn(a: TurnActivity, upgrades: Record<UpgradeId, number>): number {
	const base =
		a.tokensOut * ECONOMY.coresPerOutputToken +
		a.toolSuccesses * ECONOMY.coresPerToolSuccess +
		a.testsPassed * ECONOMY.coresPerTestPassed;
	const mult = 1 + 0.1 * upgradeLevel(upgrades, "overclock");
	return Math.floor(base * mult);
}

/** XP earned from a turn, after the Neural Boost multiplier. */
export function xpFromTurn(a: TurnActivity, upgrades: Record<UpgradeId, number>): number {
	const base =
		a.tokensOut * XP.perOutputToken +
		a.toolCalls * XP.perToolCall +
		a.edits * XP.perEdit +
		a.testsPassed * XP.perTestPassed;
	const mult = 1 + 0.1 * upgradeLevel(upgrades, "neural_boost");
	return Math.floor(base * mult);
}

/**
 * Efficiency: edits landed per 1k output tokens. ~1.0 is a clean run;
 * higher means more code change per token. Returns 0 when no tokens yet.
 */
export function efficiency(edits: number, tokensOut: number): number {
	if (tokensOut <= 0) return 0;
	return edits / (tokensOut / 1000);
}

/** Tokens per second over an elapsed millisecond window. */
export function tokensPerSecond(tokens: number, ms: number): number {
	if (ms <= 0) return 0;
	return tokens / (ms / 1000);
}

export function upgradeCost(id: UpgradeId, currentLevel: number): number | null {
	const def = UPGRADES[id];
	if (currentLevel >= def.maxLevel) return null;
	return def.cost(currentLevel);
}
