import { describe, expect, it } from "vitest";
import { XP } from "./config.ts";
import { addXp, progress } from "./xp.ts";

describe("xp", () => {
	it("toNext is positive and strictly increasing", () => {
		let prev = 0;
		for (let l = 1; l <= 30; l++) {
			const v = XP.toNext(l);
			expect(v).toBeGreaterThan(0);
			expect(v).toBeGreaterThan(prev);
			prev = v;
		}
	});

	it("ignores non-positive amounts", () => {
		expect(addXp(3, 10, 0)).toEqual({ level: 3, xp: 10, levelsGained: 0 });
		expect(addXp(3, 10, -5)).toEqual({ level: 3, xp: 10, levelsGained: 0 });
	});

	it("levels up once and carries the remainder", () => {
		// toNext(1) = 100
		const r = addXp(1, 0, 150);
		expect(r.level).toBe(2);
		expect(r.levelsGained).toBe(1);
		expect(r.xp).toBe(50);
	});

	it("rolls over multiple levels in one add", () => {
		// toNext(1)=100, toNext(2)=283 -> 100+283=383 spans two levels
		const r = addXp(1, 0, 400);
		expect(r.level).toBe(3);
		expect(r.levelsGained).toBe(2);
		expect(r.xp).toBe(400 - 100 - XP.toNext(2));
	});

	it("progress fraction is bounded 0..1", () => {
		const p = progress(5, XP.toNext(5) * 2);
		expect(p.fraction).toBe(1);
		expect(progress(5, 0).fraction).toBe(0);
	});
});
