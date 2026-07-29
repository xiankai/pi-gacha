/**
 * HUD rendering — pure string/ANSI builders for the footer and character widget.
 * Kept separate from wiring so the formatting bits are unit-testable.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
  CHARACTERS,
  efficiency,
  type GameState,
  progress,
  renderPortrait,
} from "../src/index.ts";

/** The subset of pi's theme we use. pi's real Theme satisfies this structurally. */
export interface ThemeLike {
  fg(color: string, text: string): string;
  bold(text: string): string;
  italic(text: string): string;
}

/** Session-scoped counters (reset each session), for the live token HUD. */
export interface SessionStats {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  edits: number;
  lastTps: number;
}

export function newSessionStats(): SessionStats {
  return { tokensIn: 0, tokensOut: 0, cost: 0, edits: 0, lastTps: 0 };
}

/** Compact number formatting: 1234 -> 1.2k, 1_200_000 -> 1.2M. */
export function fmt(n: number): string {
  const v = Math.round(n);
  if (v < 1000) return `${v}`;
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

/** A two-tone XP bar of the given cell width. */
export function xpBar(
  fraction: number,
  width: number,
  theme: ThemeLike,
): string {
  const w = Math.max(1, width);
  const filled = Math.max(0, Math.min(w, Math.round(fraction * w)));
  return (
    theme.fg("success", "█".repeat(filled)) +
    theme.fg("dim", "░".repeat(w - filled))
  );
}

/** The single-line footer HUD. */
export function renderFooter(
  state: GameState,
  session: SessionStats,
  modelId: string,
  branch: string | null | undefined,
  theme: ThemeLike,
  width: number,
): string[] {
  const character = state.activeCharacterId
    ? CHARACTERS[state.activeCharacterId]
    : undefined;
  const p = progress(state.level, state.xp);
  const eff = efficiency(session.edits, session.tokensOut);

  const left =
    theme.fg("accent", "▲ ") +
    theme.bold(character?.name ?? "No Character") +
    theme.fg("warning", ` Lv.${state.level} `) +
    xpBar(p.fraction, 10, theme) +
    theme.fg("muted", ` ${p.xp}/${p.xpToNext}`);

  const right =
    theme.fg("success", `⬡${fmt(state.cores)}`) +
    theme.fg(
      "muted",
      ` · ↑${fmt(session.tokensIn)} ↓${fmt(session.tokensOut)} `,
    ) +
    theme.fg("accent", `${session.lastTps.toFixed(0)}tk/s`) +
    theme.fg("muted", ` · ⚡${eff.toFixed(2)} · $${session.cost.toFixed(3)}`) +
    (branch ? theme.fg("dim", ` · ${branch}`) : "") +
    theme.fg("dim", ` · ${modelId}`);

  const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
  return [truncateToWidth(left + " ".repeat(gap) + right, width)];
}

/** The character widget shown above the editor: name / class / affinity + a voice line. */
export function renderCharacter(
  state: GameState,
  line: string,
  theme: ThemeLike,
): string[] {
  const character = state.activeCharacterId
    ? CHARACTERS[state.activeCharacterId]
    : undefined;
  if (!character) return [theme.fg("dim", "No Character deployed.")];
  const portrait = renderPortrait(character.id); // 4 ANSI rows
  const header =
    theme.fg("success", "◆ ") +
    theme.bold(character.name) +
    theme.fg("accent", ` · ${character.klass}`) +
    theme.fg("warning", ` · ${"★".repeat(character.rarity)}`) +
    theme.fg("muted", ` · ♥${state.characters[character.id]?.affinity ?? 0}`);
  // Portrait on the left, name + voice line stacked to its right.
  const info = [
    `  ${header}`,
    `  ${theme.italic(theme.fg("muted", `"${line}"`))}`,
    "",
    "",
  ];
  return portrait.map((p, i) => `${p} ${info[i] ?? ""}`.trimEnd());
}
