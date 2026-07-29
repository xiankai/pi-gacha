/**
 * The reducer: applies game events to GameState and reports UI effects. PURE —
 * clones input, mutates the copy, never touches IO. RNG/clock are injected.
 */

import {
  achievementCores,
  achievementName,
  newlyUnlocked,
} from "./achievements.ts";
import { CHECK_IN, ECONOMY, GACHA, type UpgradeId } from "./config.ts";
import { CHARACTERS } from "./characters/registry.ts";
import { coresFromTurn, upgradeCost, xpFromTurn } from "./economy.ts";
import { pull as gachaPull, type Rng } from "./gacha.ts";
import { idleCores } from "./idle.ts";
import { dateString } from "./state.ts";
import type { ApplyResult, Effect, GameState, TurnActivity } from "./types.ts";
import { addXp } from "./xp.ts";

const clone = (s: GameState): GameState => structuredClone(s);

/** Append achievement effects for anything newly satisfied, and record them. */
function finalize(s: GameState, effects: Effect[]): ApplyResult {
  for (const id of newlyUnlocked(s)) {
    s.achievements.push(id);
    const cores = achievementCores(id);
    if (cores > 0) {
      s.cores += cores;
      s.totals.coresEarned += cores;
    }
    effects.push({ type: "achievement", id, name: achievementName(id), cores });
  }
  return { state: s, effects };
}

/** A completed coding turn: award Cores + XP, bump affinity, check unlocks. */
export function applyTurn(state: GameState, a: TurnActivity): ApplyResult {
  const s = clone(state);
  const effects: Effect[] = [];

  s.totals.turns += 1;
  s.totals.tokensIn += a.tokensIn;
  s.totals.tokensOut += a.tokensOut;
  s.totals.cost += a.cost;
  s.totals.toolCalls += a.toolCalls;
  s.totals.edits += a.edits;
  s.totals.testsPassed += a.testsPassed;

  const cores = coresFromTurn(a, s.upgrades);
  if (cores > 0) {
    s.cores += cores;
    s.totals.coresEarned += cores;
    effects.push({ type: "cores", amount: cores, reason: "coding" });
  }

  const xp = xpFromTurn(a, s.upgrades);
  const leveled = addXp(s.level, s.xp, xp);
  s.level = leveled.level;
  s.xp = leveled.xp;
  if (leveled.levelsGained > 0) {
    const award = leveled.levelsGained * ECONOMY.coresPerLevelUp;
    s.cores += award;
    s.totals.coresEarned += award;
    s.totals.levelUps += leveled.levelsGained;
    effects.push({ type: "level_up", level: s.level, coresAwarded: award });
  }

  if (s.activeCharacterId && s.characters[s.activeCharacterId]) {
    s.characters[s.activeCharacterId].affinity += 1;
  }

  return finalize(s, effects);
}

/** Session resumed at `now`: grant idle Cores accrued since last shutdown. */
export function applyIdle(state: GameState, now: number): ApplyResult {
  const s = clone(state);
  const effects: Effect[] = [];

  const { cores, hours } = idleCores(now - s.lastPlayedAt, s.upgrades);
  s.totals.sessions += 1;
  if (cores > 0) {
    s.cores += cores;
    s.totals.coresEarned += cores;
    effects.push({ type: "idle_reward", amount: cores, hours });
  }
  s.lastPlayedAt = now; // consume the accrued window

  return finalize(s, effects);
}

/**
 * Daily check-in. Must be called BEFORE applyIdle (it may reset the idle
 * window). Processes streak logic and awards daily Cores.
 */
export function applyCheckIn(state: GameState, now: number): ApplyResult {
  const s = clone(state);
  const effects: Effect[] = [];

  const today = dateString(now);
  if (s.lastCheckIn === today) {
    // Already checked in today; nothing to do.
    return finalize(s, effects);
  }

  // Determine if this continues the streak.
  const yesterday = dateString(now - 86_400_000);
  const continues = s.lastCheckIn === yesterday;
  s.streak = continues ? s.streak + 1 : 1;
  s.totalCheckIns += 1;
  s.lastCheckIn = today;

  // Calculate core reward.
  const bonus = Math.min(
    CHECK_IN.maxStreakBonus,
    s.streak * CHECK_IN.streakBonusPerDay,
  );
  const award = CHECK_IN.baseCores + bonus;
  s.cores += award;
  s.totals.coresEarned += award;

  effects.push({ type: "check_in", streak: s.streak, cores: award });
  return finalize(s, effects);
}

/** One gacha pull. Returns a `notify` effect (no state change) if too poor. */
export function applyPull(
  state: GameState,
  rng: Rng,
  now: number,
): ApplyResult {
  if (state.cores < GACHA.pullCost) {
    return {
      state,
      effects: [
        { type: "notify", message: "Not enough Cores for a pull, Commander." },
      ],
    };
  }
  const s = clone(state);
  const effects: Effect[] = [];

  s.cores -= GACHA.pullCost;
  s.totals.pulls += 1;

  const outcome = gachaPull(Object.keys(s.characters), s.pity, rng);
  s.pity = outcome.pity;

  if (outcome.characterId) {
    s.characters[outcome.characterId] = {
      id: outcome.characterId,
      affinity: 0,
      obtainedAt: now,
    };
  } else if (outcome.refund > 0) {
    s.cores += outcome.refund;
  }
  effects.push({
    type: "pull",
    rarity: outcome.rarity,
    characterId: outcome.characterId,
    dupe: outcome.dupe,
    refund: outcome.refund,
  });

  return finalize(s, effects);
}

/** Set the active character (must be owned). */
export function applySwitch(
  state: GameState,
  characterId: string,
): ApplyResult {
  if (!CHARACTERS[characterId]) {
    return {
      state,
      effects: [
        { type: "notify", message: `Unknown Character: ${characterId}.` },
      ],
    };
  }
  if (!state.characters[characterId]) {
    return {
      state,
      effects: [
        {
          type: "notify",
          message: `${CHARACTERS[characterId].name} isn't on your roster yet.`,
        },
      ],
    };
  }
  const s = clone(state);
  s.activeCharacterId = characterId;
  return {
    state: s,
    effects: [
      {
        type: "notify",
        message: `${CHARACTERS[characterId].name} is now deployed.`,
      },
    ],
  };
}

/** Buy one level of an upgrade. */
export function applyUpgrade(state: GameState, id: UpgradeId): ApplyResult {
  const cost = upgradeCost(id, state.upgrades[id] ?? 0);
  if (cost === null) {
    return {
      state,
      effects: [{ type: "notify", message: "That upgrade is already maxed." }],
    };
  }
  if (state.cores < cost) {
    return {
      state,
      effects: [
        { type: "notify", message: `Need ${cost} Cores for that upgrade.` },
      ],
    };
  }
  const s = clone(state);
  s.cores -= cost;
  s.upgrades[id] = (s.upgrades[id] ?? 0) + 1;
  return {
    state: s,
    effects: [
      {
        type: "notify",
        message: `Upgrade purchased (level ${s.upgrades[id]}).`,
      },
    ],
  };
}
