import { describe, expect, it } from "vitest";
import { GACHA } from "./config.ts";
import { pull, rollRarity } from "./gacha.ts";

/** Deterministic rng that yields a fixed sequence. */
const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe("rollRarity", () => {
  it("maps rng into the rate bands", () => {
    expect(rollRarity(0, seq([0.1]))).toBe(3); // <0.75
    expect(rollRarity(0, seq([0.8]))).toBe(4); // <0.95
    expect(rollRarity(0, seq([0.99]))).toBe(5);
  });

  it("forces a 5★ at the pity ceiling without consuming rng", () => {
    const rng = seq([0.0]); // would be a 3★ if consulted
    expect(rollRarity(GACHA.pity5 - 1, rng)).toBe(5);
  });
});

describe("pull", () => {
  const owned = ["vanguard"];

  it("gives a new 5★ character and resets pity", () => {
    const out = pull(owned, 3, seq([0.99, 0]));
    expect(out.rarity).toBe(5);
    expect(out.characterId).toBe("sentinel");
    expect(out.dupe).toBe(false);
    expect(out.pity).toBe(0);
  });

  it("gives a new 4★ character and increments pity", () => {
    const out = pull(owned, 3, seq([0.8, 0]));
    expect(out.rarity).toBe(4);
    expect(out.characterId).toBe("bulwark"); // first unowned 4★ in pool order
    expect(out.pity).toBe(4);
  });

  it("gives the 3★ character from the pool", () => {
    const out = pull(owned, 0, seq([0.1]));
    expect(out.rarity).toBe(3);
    expect(out.characterId).toBe("wisp");
    expect(out.dupe).toBe(false);
    expect(out.refund).toBe(0);
  });

  it("refunds a dupe when the tier's characters are all owned", () => {
    const out = pull(["vanguard", "sentinel"], 0, seq([0.99]));
    expect(out.rarity).toBe(5);
    expect(out.characterId).toBeNull();
    expect(out.dupe).toBe(true);
    expect(out.refund).toBe(GACHA.dupeRefund[5]);
  });

  it("pity guarantees a 5★ within pity5 pulls (statistical)", () => {
    // Always roll low (would never naturally hit 5★); pity must force one.
    let pity = 0;
    let sawFive = false;
    for (let i = 0; i < GACHA.pity5; i++) {
      const out = pull(["vanguard", "sentinel"], pity, seq([0.0]));
      pity = out.pity;
      if (out.rarity === 5) sawFive = true;
    }
    expect(sawFive).toBe(true);
  });
});
