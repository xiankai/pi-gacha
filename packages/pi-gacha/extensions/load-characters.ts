/**
 * Load custom character definitions from user-configurable paths.
 * Users can define custom characters in:
 *   Global:  ~/.pi/agent/pi-gacha/characters.json
 *   Project: .pi/pi-gacha/characters.json  (project-local, takes priority)
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { mergeCharacters, type CharacterDef } from "../src/index.ts";

function agentDir(): string {
	const env = process.env.PI_CODING_AGENT_DIR;
	if (env) return env.startsWith("~/") ? join(homedir(), env.slice(2)) : env;
	return join(homedir(), ".pi", "agent");
}

function globalCharactersPath(): string {
	return join(agentDir(), "pi-gacha", "characters.json");
}

function projectCharactersPath(cwd: string): string {
	return join(cwd, ".pi", "pi-gacha", "characters.json");
}

function loadFile(path: string): Record<string, CharacterDef> | null {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, CharacterDef>;
	} catch {
		return null;
	}
}

/** Read and apply custom character definitions. Call at session_start. */
export function applyCustomCharacters(cwd: string): void {
	const globalPath = globalCharactersPath();
	const projectPath = projectCharactersPath(cwd);

	const globalChars = loadFile(globalPath);
	const projectChars = loadFile(projectPath);

	const merged: Record<string, CharacterDef> = {};
	if (globalChars) Object.assign(merged, globalChars);
	if (projectChars) Object.assign(merged, projectChars); // project wins

	if (Object.keys(merged).length > 0) {
		mergeCharacters(merged);
	}
}
