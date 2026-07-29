/**
 * GachaReveal — a flashy full-screen summoning animation.
 *
 * Renders a rarity-colored overlay with phases:
 *   0 → sparkle particles and a shimmering "Summoning…"
 *   1 → rarity splash (5★ gold / 4★ purple / 3★ blue burst)
 *   2 → full reveal: ANSI portrait, name, stars, class, voice line
 *
 * Press any key (Enter / Space / Esc) to dismiss the overlay.
 */

import type { TUI, Component } from "@earendil-works/pi-tui";
import {
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { Container, Text, Spacer } from "@earendil-works/pi-tui";
import { renderPortrait } from "../src/portrait.ts";
import { CHARACTERS } from "../src/characters/registry.ts";
import type { Rarity } from "../src/config.ts";

// ── Raw ANSI helpers (24-bit) ──────────────────────────────────────────
const RESET = "\x1b[0m";
const fg = (r: number, g: number, b: number, s: string) =>
  `\x1b[38;2;${r};${g};${b}m${s}${RESET}`;
const bg = (r: number, g: number, b: number, s: string) =>
  `\x1b[48;2;${r};${g};${b}m${s}${RESET}`;
const bold = (s: string) => `\x1b[1m${s}${RESET}`;

// Rarity colours
const RARITY_COLORS: Record<Rarity, [number, number, number]> = {
  3: [52, 152, 219], // blue
  4: [155, 89, 182], // purple
  5: [255, 215, 0], // gold
};

function rarityColor(rarity: Rarity, text: string): string {
  const [r, g, b] = RARITY_COLORS[rarity];
  return fg(r, g, b, text);
}

/** Sparkle particle states (purely visual). */
interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  char: string;
  col: [number, number, number];
}

function randomParticle(
  col: [number, number, number],
  width: number,
  height: number,
): Particle {
  const chars = ["✦", "✧", "⋆", "·", "∘", "⚝"];
  return {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
    age: 0,
    maxAge: 20 + Math.floor(Math.random() * 30),
    char: chars[Math.floor(Math.random() * chars.length)],
    col,
  };
}

// ── The reveal component ────────────────────────────────────────────────
export interface GachaRevealOptions {
  rarity: Rarity;
  characterId: string;
  voiceLine: string;
  isNew: boolean;
  name: string;
  klass: string;
  refund: number;
}

export class GachaReveal implements Component {
  private options: GachaRevealOptions;
  private phase: 0 | 1 | 2 = 0;
  private startTime: number;
  private tui: TUI | null = null;
  private particles: Particle[] = [];
  private width = 60;

  /** Call to dismiss the overlay. */
  public onDismiss?: () => void;

  constructor(options: GachaRevealOptions, tui: TUI) {
    this.options = options;
    this.tui = tui;
    this.startTime = Date.now();
  }

  // ── Component interface ──────────────────────────────────────────
  public invalidate(): void {
    /* no cache */
  }

  public render(width: number): string[] {
    this.width = width;
    const elapsed = Date.now() - this.startTime;
    const col = RARITY_COLORS[this.options.rarity];

    // Phase transitions
    if (elapsed < 700) this.phase = 0;
    else if (elapsed < 1500) this.phase = 1;
    else this.phase = 2;

    // Build the particle layer (lives across phases)
    this.tickParticles(width, 16, col);

    // Phase 0 — summoning shimmer
    if (this.phase === 0) {
      const dots = Math.min(3, Math.floor(elapsed / 200) + 1);
      const content = this.renderFrame(width, 16, [
        new Spacer(4),
        new Text(
          this.center(
            width,
            rarityColor(
              this.options.rarity,
              bold("✦ S U M M O N I N G" + ".".repeat(dots)),
            ),
          ),
          0,
          0,
        ),
        new Spacer(1),
        new Text(
          this.center(
            width,
            fg(180, 180, 180, "...a new star stirs in the sky..."),
          ),
          0,
          0,
        ),
      ]);
      return this.applyParticles(content, width);
    }

    // Phase 1 — rarity burst
    if (this.phase === 1) {
      const starLine = this.center(
        width,
        rarityColor(
          this.options.rarity,
          bold("★ ".repeat(this.options.rarity)),
        ),
      );
      const tier =
        this.options.rarity === 5
          ? "LEGENDARY"
          : this.options.rarity === 4
            ? "ELITE"
            : "RARE";
      const content = this.renderFrame(width, 16, [
        new Spacer(3),
        new Text(
          this.center(
            width,
            rarityColor(this.options.rarity, bold(`✦ ${tier} ✦`)),
          ),
          0,
          0,
        ),
        new Spacer(1),
        new Text(starLine, 0, 0),
        new Spacer(1),
        new Text(
          this.center(width, fg(180, 180, 180, "A Character approaches...")),
          0,
          0,
        ),
      ]);
      return this.applyParticles(content, width);
    }

    // Phase 2 — full reveal
    return this.renderReveal(width, col);
  }

  public handleInput(data: string): void {
    if (
      matchesKey(data, Key.enter) ||
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.space)
    ) {
      this.onDismiss?.();
    }
  }

  // ── Internal ─────────────────────────────────────────────────────

  private center(width: number, text: string): string {
    const pad = Math.max(0, Math.floor((width - visibleWidth(text)) / 2));
    return " ".repeat(pad) + text;
  }

  /** Render content inside a DynamicBorder frame, with the theme from pi. */
  private renderFrame(
    width: number,
    height: number,
    children: Component[],
  ): string[] {
    const container = new Container();
    // Top border — we need a theme. Use a plain box-drawing fallback since
    // we don't have the theme reference here. We'll overlay particles anyway.
    const h = "━";
    const top = "┏" + h.repeat(width - 2) + "┓";
    container.addChild(new Text(top, 0, 0));
    for (const c of children) container.addChild(c);
    // Bottom border
    const bot = "┗" + h.repeat(width - 2) + "┛";
    container.addChild(new Text(bot, 0, 0));
    return container.render(width);
  }

  /** Draw floating particles over the given lines. */
  private applyParticles(lines: string[], width: number): string[] {
    const out = lines.map((l) => l.split(""));
    for (const p of this.particles) {
      if (p.age >= p.maxAge) continue;
      const y = p.y;
      const x = p.x;
      if (y >= 0 && y < out.length && x >= 0 && x < width) {
        const [r, g, b] = p.col;
        const ansi = `\x1b[38;2;${r};${g};${b}m${p.char}\x1b[0m`;
        // Replace that cell, accounting for ANSI overhead (cell is at raw x position)
        // Simpler: just overlay the char if the line is short enough
        let line = out[y].join("");
        // Only draw if this cell isn't part of a previous ANSI escape
        if (line.length > x) {
          const prefix = line.slice(0, x);
          const suffix = line.slice(x + 1);
          // Calculate visual position more carefully using visibleWidth
          const prefixLen = visibleWidth(prefix);
          if (prefixLen >= x) {
            out[y] = (prefix + ansi + suffix).split("");
          }
        }
      }
    }
    return out.map((a) => a.join(""));
  }

  /** Advance particle lifetimes and spawn new ones during phases 0-1. */
  private tickParticles(
    width: number,
    height: number,
    col: [number, number, number],
  ) {
    // Age existing
    for (const p of this.particles) p.age += 1;
    // Spawn new during summoning / rarity phases
    if (this.phase < 2 && Math.random() < 0.5) {
      this.particles.push(randomParticle(col, width, height));
    }
    // GC dead particles
    this.particles = this.particles.filter((p) => p.age < p.maxAge);
    // Cap
    if (this.particles.length > 40) this.particles = this.particles.slice(-40);
  }

  /** Phase 2: the full character reveal with portrait. */
  private renderReveal(width: number, col: [number, number, number]): string[] {
    const { rarity, characterId, name, klass, voiceLine, isNew, refund } =
      this.options;
    const [r, g, b] = col;
    const portrait = renderPortrait(characterId);
    const starStr = rarityColor(rarity, bold("★ ".repeat(rarity)));

    // Build lines manually for precise layout
    const lines: string[] = [];

    // Top border in rarity colour
    const h = "═";
    lines.push(fg(r, g, b, "╔" + h.repeat(width - 2) + "╗"));

    // Top padding
    lines.push(fg(r, g, b, "║") + " ".repeat(width - 2) + fg(r, g, b, "║")); // 1
    lines.push(fg(r, g, b, "║") + " ".repeat(width - 2) + fg(r, g, b, "║")); // 2

    // Gacha header
    const gachaLabel = isNew
      ? "★  N E W   D O L L  ★"
      : "★  D U P L I C A T E  ★";
    const headerLabel = this.center(width - 2, fg(r, g, b, bold(gachaLabel))); // clippable
    lines.push(fg(r, g, b, "║") + headerLabel + fg(r, g, b, "║"));

    // Blank line
    lines.push(fg(r, g, b, "║") + " ".repeat(width - 2) + fg(r, g, b, "║"));

    // Portrait block — centre it
    const portraitWidth = 12;
    const portraitPad = Math.max(
      0,
      Math.floor((width - 2 - portraitWidth) / 2),
    );
    const sideBar = fg(r, g, b, "║");
    for (const pLine of portrait) {
      const padded =
        " ".repeat(portraitPad) +
        pLine +
        " ".repeat(width - 2 - portraitPad - portraitWidth);
      lines.push(sideBar + padded + sideBar);
    }

    // Blank line
    lines.push(sideBar + " ".repeat(width - 2) + sideBar);

    // Character name
    const nameLine = this.center(
      width - 2,
      fg(r, g, b, bold(name.toUpperCase())),
    );
    lines.push(sideBar + nameLine + sideBar);

    // Class
    const klassLine = this.center(width - 2, fg(r, g, b, `· ${klass} ·`));
    lines.push(sideBar + klassLine + sideBar);

    // Rarity stars
    const starsLine = this.center(width - 2, starStr);
    lines.push(sideBar + starsLine + sideBar);

    // Blank
    lines.push(sideBar + " ".repeat(width - 2) + sideBar);

    // Refund notice if dupe
    if (!isNew && refund > 0) {
      const refundStr = this.center(
        width - 2,
        fg(255, 255, 150, `+${refund} Cores (dupe refund)`),
      );
      lines.push(sideBar + refundStr + sideBar);
      lines.push(sideBar + " ".repeat(width - 2) + sideBar);
    }

    // Voice line (italic via dim for terminals that support it)
    const voiceStr = this.center(
      width - 2,
      fg(200, 200, 200, `"${voiceLine}"`),
    );
    lines.push(sideBar + voiceStr + sideBar);

    // Bottom padding
    lines.push(sideBar + " ".repeat(width - 2) + sideBar);

    // Dismiss hint
    const hintStr = this.center(
      width - 2,
      fg(140, 140, 140, "[ Enter / Space / Esc to dismiss ]"),
    );
    lines.push(sideBar + hintStr + sideBar);

    // Bottom border
    lines.push(fg(r, g, b, "╚" + h.repeat(width - 2) + "╝"));

    return lines.map((l) => truncateToWidth(l, width));
  }
}

/** Convenience: create and run the full gacha reveal dialog. */
export async function showGachaReveal(
  ctx: {
    ui: {
      custom<T>(
        factory: (
          tui: TUI,
          _theme: unknown,
          kb: unknown,
          done: (v: T) => void,
        ) => Component,
        opts?: unknown,
      ): Promise<T>;
    };
  },
  rarity: Rarity,
  characterId: string,
  isNew: boolean,
  refund: number,
  width?: number,
): Promise<void> {
  const character = CHARACTERS[characterId]!;
  const voiceLines = character.voiceLines.gacha ?? [];
  const voiceLine =
    voiceLines[Math.floor(Math.random() * voiceLines.length)] ?? "";

  await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
    const reveal = new GachaReveal(
      {
        rarity,
        characterId,
        voiceLine,
        isNew,
        name: character.name,
        klass: character.klass,
        refund,
      },
      tui,
    );
    reveal.onDismiss = () => done();

    // Auto-advance animation phases via periodic re-render
    const interval = setInterval(() => tui.requestRender(), 80);
    // Auto-dismiss after 30s timeout
    const timeout = setTimeout(() => {
      clearInterval(interval);
      done();
    }, 30_000);

    const origInvalidate = reveal.invalidate.bind(reveal);
    reveal.invalidate = () => {
      origInvalidate();
      tui.requestRender();
    };

    return {
      render: (w: number) => {
        const result = reveal.render(w);
        // Stop animation interval once we're past phase 2 and user has time
        return result;
      },
      invalidate: () => reveal.invalidate(),
      handleInput: (data: string) => {
        if (
          matchesKey(data, Key.enter) ||
          matchesKey(data, Key.escape) ||
          matchesKey(data, Key.space)
        ) {
          clearInterval(interval);
          clearTimeout(timeout);
          done();
        }
      },
    };
  });
}
