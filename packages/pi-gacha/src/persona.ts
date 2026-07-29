/**
 * Persona construction — pure. Builds the system-prompt fragment injected for
 * the active character, lightly colored by affinity and session mood ("flavor + light
 * quirks": tone shifts, but the character always completes the task).
 */

import { CHARACTERS } from "./characters/registry.ts";

export type Mood = "neutral" | "confident" | "strained";

/** Derive mood from recent turn outcomes. */
export function deriveMood(successStreak: number, errorStreak: number): Mood {
  if (errorStreak >= 2) return "strained";
  if (successStreak >= 3) return "confident";
  return "neutral";
}

/** Build the persona system-prompt fragment for a character. Empty string if unknown. */
export function buildPersona(
  characterId: string,
  affinity: number,
  mood: Mood,
): string {
  const character = CHARACTERS[characterId];
  if (!character) return "";

  const parts: string[] = [
    `# Active Character — respond in character as ${character.name}`,
    character.persona,
  ];

  if (affinity >= 50) {
    parts.push(
      "You and the Commander have a long history together; be a little warmer and more familiar.",
    );
  } else if (affinity >= 20) {
    parts.push("You're growing comfortable working with the Commander.");
  }

  if (mood === "confident") {
    parts.push(
      "Recent work has gone smoothly — let a little pride or warmth show.",
    );
  } else if (mood === "strained") {
    parts.push(
      "The last few steps hit errors — stay steady and reassuring, and don't get flustered.",
    );
  }

  parts.push(
    "Keep in-character remarks to a brief sentence or two, and never let flavor delay, dilute, or replace the actual engineering work — correctness and the Commander's request always come first.",
  );

  return parts.join("\n");
}
