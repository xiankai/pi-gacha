import { describe, expect, it } from "vitest";
import { SAVE_VERSION } from "./config.ts";
import { DEFAULT_CHAR_ID } from "./characters/registry.ts";
import { defaultState, migrate } from "./state.ts";

describe("defaultState", () => {
  it("starts at level 1 with the starter character deployed", () => {
    const s = defaultState(1000);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.level).toBe(1);
    expect(s.activeCharacterId).toBe(DEFAULT_CHAR_ID);
    expect(s.characters[DEFAULT_CHAR_ID].obtainedAt).toBe(1000);
    expect(Object.keys(s.characters)).toHaveLength(1);
  });
});

describe("migrate", () => {
  it("returns a full default for garbage input", () => {
    expect(migrate(null, 5).level).toBe(1);
    expect(migrate("nope", 5).level).toBe(1);
    expect(migrate(42, 5).activeCharacterId).toBe(DEFAULT_CHAR_ID);
  });

  it("fills missing fields and coerces bad numbers", () => {
    const s = migrate({ level: "x", cores: -10, xp: 40 }, 7);
    expect(s.level).toBe(1); // "x" -> default
    expect(s.cores).toBe(0); // negative clamped
    expect(s.xp).toBe(40);
    expect(s.upgrades.overclock).toBe(0);
    expect(s.totals.turns).toBe(0);
  });

  it("preserves known characters and always guarantees the starter", () => {
    const s = migrate(
      {
        characters: { sentinel: { affinity: 3, obtainedAt: 1 } },
        activeCharacterId: "sentinel",
      },
      9,
    );
    expect(s.characters.sentinel.affinity).toBe(3);
    expect(s.characters[DEFAULT_CHAR_ID]).toBeDefined();
    expect(s.activeCharacterId).toBe("sentinel");
  });

  it("resets activeCharacterId to the starter if it points at an unowned character", () => {
    const s = migrate({ activeCharacterId: "wisp" }, 9); // unknown character id
    expect(s.activeCharacterId).toBe(DEFAULT_CHAR_ID);
  });
});
