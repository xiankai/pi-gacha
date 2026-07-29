import { describe, expect, it } from "vitest";
import type { UpgradeId } from "./config.ts";
import { coresFromTurn, efficiency, tokensPerSecond, upgradeCost, xpFromTurn } from "./economy.ts";
import type { TurnActivity } from "./types.ts";

const noUpgrades = { overclock: 0, neural_boost: 0, idle_array: 0 } as Record<UpgradeId, number>;

const turn = (o: Partial<TurnActivity> = {}): TurnActivity => ({
	tokensIn: 0,
	tokensOut: 0,
	cost: 0,
	toolCalls: 0,
	toolSuccesses: 0,
	edits: 0,
	testsPassed: 0,
	...o,
});

describe("economy", () => {
	it("cores from a turn: tokens + tool successes + tests", () => {
		const a = turn({ tokensOut: 5000, toolSuccesses: 2, testsPassed: 1 });
		// 5000*0.01 + 2*1 + 1*10 = 62
		expect(coresFromTurn(a, noUpgrades)).toBe(62);
	});

	it("overclock multiplies cores by +10% per level", () => {
		const a = turn({ tokensOut: 5000 }); // base 50
		expect(coresFromTurn(a, { ...noUpgrades, overclock: 2 })).toBe(Math.floor(50 * 1.2));
	});

	it("xp from a turn combines all contributions", () => {
		const a = turn({ tokensOut: 5000, toolCalls: 2, edits: 3, testsPassed: 1 });
		// 100 + 10 + 30 + 50 = 190
		expect(xpFromTurn(a, noUpgrades)).toBe(190);
	});

	it("neural_boost multiplies xp", () => {
		const a = turn({ tokensOut: 5000 }); // base 100
		expect(xpFromTurn(a, { ...noUpgrades, neural_boost: 1 })).toBe(110);
	});

	it("efficiency is edits per 1k output tokens, 0 when no tokens", () => {
		expect(efficiency(2, 1000)).toBe(2);
		expect(efficiency(3, 2000)).toBe(1.5);
		expect(efficiency(5, 0)).toBe(0);
	});

	it("tokens per second over an elapsed window", () => {
		expect(tokensPerSecond(100, 2000)).toBe(50);
		expect(tokensPerSecond(100, 0)).toBe(0);
	});

	it("upgrade cost rises per level and caps at max", () => {
		expect(upgradeCost("overclock", 0)).toBe(200);
		expect(upgradeCost("overclock", 1)).toBe(400);
		expect(upgradeCost("overclock", 5)).toBeNull(); // maxLevel 5
	});
});
