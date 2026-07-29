import { describe, expect, it } from "vitest";
import { isTestFilePath, turnActivity } from "./telemetry.ts";

// Minimal stand-ins for pi's runtime types (type imports are erased at runtime).
const assistant = (usage: Partial<{ input: number; output: number; cacheRead: number; cost: number }>) => ({
	role: "assistant",
	usage: {
		input: usage.input ?? 0,
		output: usage.output ?? 0,
		cacheRead: usage.cacheRead ?? 0,
		cost: { total: usage.cost ?? 0 },
	},
});

const tr = (toolName: string, isError = false, details?: unknown, toolCallId = "t1") =>
	({ role: "toolResult", toolName, isError, details, toolCallId, content: [] }) as any;

describe("isTestFilePath", () => {
	it("matches .test. extension files", () => {
		expect(isTestFilePath("src/foo.test.ts")).toBe(true);
	});
	it("matches .spec. extension files", () => {
		expect(isTestFilePath("src/foo.spec.js")).toBe(true);
		expect(isTestFilePath("foo.spec.tsx")).toBe(true);
	});
	it("matches Go _test.go files", () => {
		expect(isTestFilePath("src/pkg/foo_test.go")).toBe(true);
	});
	it("matches test/ or tests/ directories", () => {
		expect(isTestFilePath("src/test/test_auth.py")).toBe(true);
		expect(isTestFilePath("tests/unit/test_foo.ts")).toBe(true);
	});
	it("rejects regular source files", () => {
		expect(isTestFilePath("src/foo.ts")).toBe(false);
		expect(isTestFilePath("lib/index.js")).toBe(false);
		expect(isTestFilePath("readme.md")).toBe(false);
	});
	it("handles Windows backslash paths", () => {
		expect(isTestFilePath("src\\tests\\test_foo.py")).toBe(true);
		expect(isTestFilePath("src\\foo.test.ts")).toBe(true);
	});
});

describe("turnActivity", () => {
	it("reads tokens and cost from an assistant message (cacheRead folds into input)", () => {
		const a = turnActivity(assistant({ input: 100, cacheRead: 20, output: 500, cost: 0.01 }), [], new Map());
		expect(a.tokensIn).toBe(120);
		expect(a.tokensOut).toBe(500);
		expect(a.cost).toBe(0.01);
	});

	it("ignores non-assistant messages", () => {
		const a = turnActivity({ role: "toolResult" }, [], new Map());
		expect(a.tokensOut).toBe(0);
	});

	it("counts tool calls, successes, and edits", () => {
		const a = turnActivity(assistant({ output: 10 }), [tr("edit"), tr("write"), tr("read"), tr("edit", true)], new Map());
		expect(a.toolCalls).toBe(4);
		expect(a.toolSuccesses).toBe(3);
		expect(a.edits).toBe(2); // two successful edits; the errored edit doesn't count
	});

	it("detects a passing test run from a bash command + exit 0", () => {
		const cmds = new Map([["b1", "pnpm test"]]);
		const a = turnActivity(assistant({ output: 10 }), [tr("bash", false, { exitCode: 0 }, "b1")], cmds);
		expect(a.testsPassed).toBe(1);
	});

	it("does not count a non-zero exit or a non-test command", () => {
		const failed = turnActivity(assistant({ output: 10 }), [tr("bash", false, { exitCode: 1 }, "b1")], new Map([["b1", "pnpm test"]]));
		expect(failed.testsPassed).toBe(0);
		const notTest = turnActivity(assistant({ output: 10 }), [tr("bash", false, { exitCode: 0 }, "b2")], new Map([["b2", "ls -la"]]));
		expect(notTest.testsPassed).toBe(0);
	});
});
