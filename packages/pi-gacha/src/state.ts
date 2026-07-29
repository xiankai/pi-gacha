/**
 * Save-shape helpers: default construction + defensive migration. PURE — actual
 * file IO lives in the extension. `now` is always injected (no clock here).
 */

import { SAVE_VERSION, UPGRADES, type UpgradeId } from "./config.ts";
import { DEFAULT_CHAR_ID } from "./characters/registry.ts";
import type { GameState, Totals } from "./types.ts";

function zeroTotals(): Totals {
	return {
		tokensIn: 0,
		tokensOut: 0,
		cost: 0,
		edits: 0,
		testsPassed: 0,
		toolCalls: 0,
		turns: 0,
		pulls: 0,
		sessions: 0,
		coresEarned: 0,
		levelUps: 0,
	};
}

function zeroUpgrades(): Record<UpgradeId, number> {
	const u = {} as Record<UpgradeId, number>;
	for (const id of Object.keys(UPGRADES) as UpgradeId[]) u[id] = 0;
	return u;
}

function toDateString(ms: number): string {
	const d = new Date(ms);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

export function dateString(now: number): string {
	return toDateString(now);
}

export function defaultState(now: number): GameState {
	const today = toDateString(now);
	return {
		version: SAVE_VERSION,
		level: 1,
		xp: 0,
		cores: 0,
		activeCharacterId: DEFAULT_CHAR_ID,
		characters: { [DEFAULT_CHAR_ID]: { id: DEFAULT_CHAR_ID, affinity: 0, obtainedAt: now } },
		achievements: [],
		upgrades: zeroUpgrades(),
		pity: 0,
		totals: zeroTotals(),
		lastPlayedAt: now,
		lastCheckIn: today, // first session == implicit check-in
		streak: 1,
		totalCheckIns: 1,
	};
}

const num = (v: unknown, fallback: number): number =>
	typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Coerce arbitrary parsed JSON into a valid GameState, filling any missing or
 * corrupt fields from defaults. Never throws.
 */
export function migrate(raw: unknown, now: number): GameState {
	const base = defaultState(now);
	if (!raw || typeof raw !== "object") return base;
	const r = raw as Record<string, any>;

	const totals: Totals = { ...base.totals };
	if (r.totals && typeof r.totals === "object") {
		for (const k of Object.keys(totals) as (keyof Totals)[]) {
			totals[k] = num(r.totals[k], totals[k]);
		}
	}

	const upgrades = zeroUpgrades();
	if (r.upgrades && typeof r.upgrades === "object") {
		for (const id of Object.keys(upgrades) as UpgradeId[]) {
			upgrades[id] = Math.max(0, Math.floor(num(r.upgrades[id], 0)));
		}
	}

	const characters: GameState["characters"] = {};
	if (r.characters && typeof r.characters === "object") {
		for (const [id, v] of Object.entries(r.characters as Record<string, any>)) {
			characters[id] = {
				id,
				affinity: Math.max(0, num(v?.affinity, 0)),
				obtainedAt: num(v?.obtainedAt, now),
			};
		}
	}
	// Guarantee the starter is always present.
	if (!characters[DEFAULT_CHAR_ID]) {
		characters[DEFAULT_CHAR_ID] = { id: DEFAULT_CHAR_ID, affinity: 0, obtainedAt: now };
	}

	const activeCharacterId =
		typeof r.activeCharacterId === "string" && characters[r.activeCharacterId] ? r.activeCharacterId : DEFAULT_CHAR_ID;

	const today = toDateString(now);
	// Preserve check-in fields if saved, otherwise seed them from lastPlayedAt.
	const lastCheckIn =
		typeof r.lastCheckIn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.lastCheckIn)
			? r.lastCheckIn
			: num(r.lastPlayedAt, now) > 0
				? toDateString(num(r.lastPlayedAt, now))
				: today;
	const streak = Math.max(1, Math.floor(num(r.streak, 1)));
	const totalCheckIns = Math.max(1, Math.floor(num(r.totalCheckIns, 1)));

	return {
		version: SAVE_VERSION,
		level: Math.max(1, Math.floor(num(r.level, 1))),
		xp: Math.max(0, num(r.xp, 0)),
		cores: Math.max(0, num(r.cores, 0)),
		activeCharacterId,
		characters,
		achievements: Array.isArray(r.achievements) ? r.achievements.filter((a) => typeof a === "string") : [],
		upgrades,
		pity: Math.max(0, Math.floor(num(r.pity, 0))),
		totals,
		lastPlayedAt: num(r.lastPlayedAt, now),
		lastCheckIn,
		streak,
		totalCheckIns,
	};
}
