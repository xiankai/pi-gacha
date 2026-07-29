/**
 * Global save file IO. Lives here (not in ../src) because it touches the
 * filesystem. The save is global across projects, alongside pi's own data at
 * `<agentDir>/pi-gacha/save.json` (agentDir honors PI_CODING_AGENT_DIR, else
 * ~/.pi/agent — mirrors pi's config.getAgentDir()).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type GameState, migrate } from "../src/index.ts";

function agentDir(): string {
	const env = process.env.PI_CODING_AGENT_DIR;
	if (env) return env.startsWith("~/") ? join(homedir(), env.slice(2)) : env;
	return join(homedir(), ".pi", "agent");
}

export function savePath(): string {
	return join(agentDir(), "pi-gacha", "save.json");
}

/** Load + migrate the save, or a fresh default if missing/corrupt. Never throws. */
export function loadState(now: number): GameState {
	try {
		const raw = JSON.parse(readFileSync(savePath(), "utf8"));
		return migrate(raw, now);
	} catch {
		return migrate(null, now);
	}
}

/** Persist the save. Best-effort; swallows IO errors so gameplay never breaks. */
export function saveState(state: GameState): void {
	try {
		const p = savePath();
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, JSON.stringify(state, null, 2), "utf8");
	} catch {
		// ignore — a failed save must not interrupt coding
	}
}
