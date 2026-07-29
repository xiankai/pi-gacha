/** Achievement definitions + unlock checks. Pure. */

import { CHARACTERS } from "./characters/registry.ts";
import type { GameState } from "./types.ts";

export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	/** Cores awarded on unlock. */
	cores: number;
	check: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{ id: "first_contact", name: "First Contact", description: "Complete your first turn.",   cores: 10,  check: (s) => s.totals.turns >= 1 },
	{ id: "first_blood", name: "First Blood",   description: "Land your first edit.",         cores: 20,  check: (s) => s.totals.edits >= 1 },
	{ id: "green",       name: "All Green",     description: "Pass a test run.",             cores: 25,  check: (s) => s.totals.testsPassed >= 1 },
	{ id: "kilotoken",   name: "Kilotoken",     description: "Generate 1,000 output tokens.", cores: 30,  check: (s) => s.totals.tokensOut >= 1000 },
	{ id: "megatoken",   name: "Megatoken",     description: "Generate 100,000 output tokens.",cores: 100, check: (s) => s.totals.tokensOut >= 100_000 },
	{ id: "veteran",     name: "Veteran",       description: "Reach commander level 5.",      cores: 50,  check: (s) => s.level >= 5 },
	{ id: "elite",       name: "Elite",         description: "Reach commander level 10.",     cores: 100, check: (s) => s.level >= 10 },
	{ id: "first_pull",  name: "Recruiter",     description: "Perform your first gacha pull.",cores: 30,  check: (s) => s.totals.pulls >= 1 },
	{ id: "collector",   name: "Full Roster",   description: "Obtain every Doll.",            cores: 200, check: (s) => Object.keys(CHARACTERS).every((id) => s.characters[id]) },
	{ id: "centurion",   name: "Centurion",     description: "Complete 100 turns.",           cores: 100, check: (s) => s.totals.turns >= 100 },
	// Daily check-in achievements
	{ id: "first_check_in", name: "Daily Check-in",     description: "Check in for the first time.",    cores: 20,  check: (s) => s.totalCheckIns >= 1 },
	{ id: "streak_3",      name: "Consistent",          description: "Maintain a 3-day check-in streak.", cores: 30,  check: (s) => s.streak >= 3 },
	{ id: "streak_7",      name: "Dedicated",           description: "Maintain a 7-day check-in streak.", cores: 75,  check: (s) => s.streak >= 7 },
	{ id: "streak_30",     name: "Steadfast",           description: "Maintain a 30-day check-in streak.",cores: 200, check: (s) => s.streak >= 30 },
	{ id: "check_in_10",   name: "Regular",             description: "Check in 10 times total.",          cores: 50,  check: (s) => s.totalCheckIns >= 10 },
	{ id: "check_in_50",   name: "Veteran Attendee",    description: "Check in 50 times total.",          cores: 150, check: (s) => s.totalCheckIns >= 50 },
];

/**
 * Get the Core reward for an achievement. Returns 0 if not found.
 */
export function achievementCores(id: string): number {
	return ACHIEVEMENTS.find((a) => a.id === id)?.cores ?? 0;
}


/** Return achievement ids newly satisfied by `state` but not yet recorded. */
export function newlyUnlocked(state: GameState): string[] {
	const have = new Set(state.achievements);
	return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(state)).map((a) => a.id);
}

export function achievementName(id: string): string {
	return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}
