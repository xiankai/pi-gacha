import { describe, expect, it } from "vitest";
import { IDLE, type UpgradeId } from "./config.ts";
import { idleCores } from "./idle.ts";

const upg = (o: Partial<Record<UpgradeId, number>> = {}) =>
	({ overclock: 0, neural_boost: 0, idle_array: 0, ...o }) as Record<UpgradeId, number>;

const HOUR = 3_600_000;

describe("idleCores", () => {
	it("accrues at the base rate", () => {
		expect(idleCores(2 * HOUR, upg()).cores).toBe(IDLE.baseCoresPerHour * 2);
	});

	it("never goes negative for a clock skew", () => {
		expect(idleCores(-5000, upg()).cores).toBe(0);
	});

	it("caps accrual", () => {
		const r = idleCores(1000 * HOUR, upg());
		expect(r.cores).toBe(IDLE.capCores);
	});

	it("idle_array boosts both rate and cap by +50% per level", () => {
		const r = idleCores(2 * HOUR, upg({ idle_array: 2 })); // boost x2
		expect(r.cores).toBe(IDLE.baseCoresPerHour * 2 * 2);
		expect(idleCores(1000 * HOUR, upg({ idle_array: 2 })).cores).toBe(IDLE.capCores * 2);
	});
});
