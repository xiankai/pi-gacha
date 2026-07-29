/**
 * Turns pi's `turn_end` payload into a pure `TurnActivity` for the reducer.
 * This is the seam between pi's runtime types and the game core.
 */

import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import type { TurnActivity } from "../src/index.ts";

/** Built-in + common file-mutating tools that count as an "edit". */
const EDIT_TOOLS = new Set(["edit", "write", "multiedit", "apply_patch"]);

/** Heuristic: a bash command that looks like it ran a test suite. */
const TEST_CMD =
	/\b(vitest|jest|pytest|mocha|rspec|phpunit|go\s+test|cargo\s+test|(?:npm|pnpm|yarn|bun)(?:\s+run)?\s+test)\b/i;

/** Recognised test file patterns. */
const TEST_FILE_RE = /(?:^|[\/\\])tests?(?:[\/\\]|$)|\.(?:test|spec)\.[a-z]+$|_test\.go$/i;

/** Check if a file path looks like a test file. */
export function isTestFilePath(path: string): boolean {
	return TEST_FILE_RE.test(path);
}

/**
 * Extract per-turn activity. `bashCommands` maps toolCallId -> command text,
 * captured from `tool_call` events (turn_end results don't carry the command).
 */
export function turnActivity(
	message: unknown,
	toolResults: ToolResultMessage[] | undefined,
	bashCommands: Map<string, string>,
): TurnActivity {
	const a: TurnActivity = {
		tokensIn: 0,
		tokensOut: 0,
		cost: 0,
		toolCalls: 0,
		toolSuccesses: 0,
		edits: 0,
		testsPassed: 0,
	};

	const m = message as Partial<AssistantMessage> | undefined;
	if (m?.role === "assistant" && m.usage) {
		a.tokensIn = m.usage.input + (m.usage.cacheRead ?? 0);
		a.tokensOut = m.usage.output;
		a.cost = m.usage.cost?.total ?? 0;
	}

	for (const r of toolResults ?? []) {
		a.toolCalls += 1;
		if (r.isError) continue;
		a.toolSuccesses += 1;
		if (EDIT_TOOLS.has(r.toolName)) a.edits += 1;
		if (r.toolName === "bash") {
			const cmd = bashCommands.get(r.toolCallId) ?? "";
			const exit = (r.details as { exitCode?: number } | undefined)?.exitCode;
			// isError already false here; require a zero exit code when we have one.
			if (TEST_CMD.test(cmd) && (exit === undefined || exit === 0)) a.testsPassed += 1;
		}
	}

	return a;
}
