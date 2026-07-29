import { describe, expect, it } from "vitest";
import { ECONOMY, GACHA } from "./config.ts";
import {
  applyIdle,
  applyPull,
  applySwitch,
  applyTurn,
  applyUpgrade,
} from "./reducer.ts";
import { defaultState } from "./state.ts";
import type { Effect, TurnActivity } from "./types.ts";

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

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

const has = (effects: Effect[], type: Effect["type"]) =>
  effects.some((e) => e.type === type);

describe("applyTurn", () => {
  it("awards cores + xp, levels up, bumps affinity, unlocks achievements", () => {
    const s0 = defaultState(0);
    const { state, effects } = applyTurn(
      s0,
      turn({
        tokensOut: 5000,
        tokensIn: 1000,
        toolCalls: 2,
        toolSuccesses: 2,
        edits: 3,
        testsPassed: 1,
      }),
    );

    // cores: 5000*0.01 + 2 + 10 = 62, plus level-up award 50,
    // plus achievement rewards: first_contact(10)+first_blood(20)+green(25)+kilotoken(30)+first_check_in(20)
    const achievementCores = 10 + 20 + 25 + 30 + 20;
    expect(state.totals.coresEarned).toBe(
      62 + ECONOMY.coresPerLevelUp + achievementCores,
    );
    expect(state.cores).toBe(62 + ECONOMY.coresPerLevelUp + achievementCores);

    // xp 190 -> level 2 (toNext(1)=100), remainder 90
    expect(state.level).toBe(2);
    expect(state.xp).toBe(90);

    expect(state.characters.vanguard.affinity).toBe(1);
    expect(has(effects, "level_up")).toBe(true);
    expect(has(effects, "cores")).toBe(true);

    // first_contact, first_blood, green, kilotoken, first_check_in
    expect(state.achievements).toEqual(
      expect.arrayContaining([
        "first_contact",
        "first_blood",
        "green",
        "kilotoken",
        "first_check_in",
      ]),
    );
  });

  it("does not mutate the input state", () => {
    const s0 = defaultState(0);
    applyTurn(s0, turn({ tokensOut: 5000, edits: 1 }));
    expect(s0.cores).toBe(0);
    expect(s0.totals.turns).toBe(0);
  });
});

describe("applyIdle", () => {
  it("grants accrued cores for time away", () => {
    const s0 = { ...defaultState(0), lastPlayedAt: 0 };
    const now = 2 * 3_600_000;
    const { state, effects } = applyIdle(s0, now);
    // 2h * 30/h = 60, plus first_check_in achievement reward (20)
    expect(state.cores).toBe(60 + 20);
    expect(state.lastPlayedAt).toBe(now);
    expect(has(effects, "idle_reward")).toBe(true);
  });
});

describe("applyPull", () => {
  it("refuses when too poor", () => {
    const s0 = defaultState(0);
    const { state, effects } = applyPull(s0, seq([0.99, 0]), 0);
    expect(state).toBe(s0); // unchanged reference
    expect(has(effects, "notify")).toBe(true);
  });

  it("spends cores, obtains a character, records the pull", () => {
    const s0 = { ...defaultState(0), cores: GACHA.pullCost };
    const { state, effects } = applyPull(s0, seq([0.99, 0]), 123);
    // Pull costs 300; first_check_in(20) + first_pull(30) awarded
    expect(state.cores).toBe(20 + 30);
    expect(state.totals.pulls).toBe(1);
    expect(state.characters.sentinel).toBeDefined();
    expect(state.characters.sentinel.obtainedAt).toBe(123);
    expect(has(effects, "pull")).toBe(true);
    expect(state.achievements).toContain("first_pull");
    expect(state.achievements).toContain("first_check_in");
  });

  it("refunds cores on a dupe", () => {
    const s0 = {
      ...defaultState(0),
      cores: GACHA.pullCost,
      characters: {
        vanguard: { id: "vanguard", affinity: 0, obtainedAt: 0 },
        sentinel: { id: "sentinel", affinity: 0, obtainedAt: 0 },
      },
    };
    const { state } = applyPull(s0, seq([0.99]), 0);
    // Dupe refund 150 + first_check_in(20) + first_pull(30)
    expect(state.cores).toBe(GACHA.dupeRefund[5] + 20 + 30);
  });
});

describe("applySwitch", () => {
  it("rejects an unowned character", () => {
    const s0 = defaultState(0);
    const { state, effects } = applySwitch(s0, "sentinel");
    expect(state.activeCharacterId).toBe("vanguard");
    expect(has(effects, "notify")).toBe(true);
  });

  it("deploys an owned character", () => {
    const s0 = {
      ...defaultState(0),
      characters: {
        vanguard: { id: "vanguard", affinity: 0, obtainedAt: 0 },
        sentinel: { id: "sentinel", affinity: 0, obtainedAt: 0 },
      },
    };
    const { state } = applySwitch(s0, "sentinel");
    expect(state.activeCharacterId).toBe("sentinel");
  });
});

describe("applyUpgrade", () => {
  it("buys a level when affordable", () => {
    const s0 = { ...defaultState(0), cores: 200 };
    const { state } = applyUpgrade(s0, "overclock");
    expect(state.upgrades.overclock).toBe(1);
    expect(state.cores).toBe(0);
  });

  it("refuses when too poor", () => {
    const s0 = { ...defaultState(0), cores: 10 };
    const { state } = applyUpgrade(s0, "overclock");
    expect(state.upgrades.overclock).toBe(0);
    expect(state.cores).toBe(10);
  });
});
