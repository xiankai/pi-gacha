/** Core data model. Plain serializable types — no pi/Node imports. */

import type { Rarity, UpgradeId } from "./config.ts";

export interface CharacterState {
	id: string;
	/** Grows with use; gates warmer voice lines. */
	affinity: number;
	obtainedAt: number;
}

/** Lifetime counters — feed stats, achievements, and the economy. */
export interface Totals {
	tokensIn: number;
	tokensOut: number;
	cost: number;
	edits: number;
	testsPassed: number;
	toolCalls: number;
	turns: number;
	pulls: number;
	sessions: number;
	coresEarned: number;
	levelUps: number;
}

/** The whole persisted game, global across projects. */
export interface GameState {
	version: number;
	level: number;
	/** XP accumulated toward the next level (resets to remainder on level-up). */
	xp: number;
	cores: number;
	activeCharacterId: string | null;
	characters: Record<string, CharacterState>;
	achievements: string[];
	upgrades: Record<UpgradeId, number>;
	/** Pulls since the last 5★ — drives pity. */
	pity: number;
	totals: Totals;
	/** Epoch ms of last shutdown; drives idle accrual on next start. */
	lastPlayedAt: number;
	/** Date string ("YYYY-MM-DD") of the last daily check-in, or null if never. */
	lastCheckIn: string | null;
	/** Consecutive-day check-in streak. */
	streak: number;
	/** Lifetime check-in count. */
	totalCheckIns: number;
}

/** Per-turn coding activity, extracted by the extension from pi events. */
export interface TurnActivity {
	tokensIn: number;
	tokensOut: number;
	cost: number;
	toolCalls: number;
	toolSuccesses: number;
	edits: number;
	testsPassed: number;
}

/** Something the UI should surface as a result of applying an event. */
export type Effect =
	| { type: "level_up"; level: number; coresAwarded: number }
	| { type: "achievement"; id: string; name: string; cores: number }
	| { type: "cores"; amount: number; reason: string }
	| { type: "idle_reward"; amount: number; hours: number }
	| { type: "pull"; rarity: Rarity; characterId: string | null; dupe: boolean; refund: number }
	| { type: "check_in"; streak: number; cores: number }
	| { type: "notify"; message: string };

export interface ApplyResult {
	state: GameState;
	effects: Effect[];
}
