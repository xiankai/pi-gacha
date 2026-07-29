import { describe, expect, it } from "vitest";
import { defaultState } from "../src/index.ts";
import {
  fmt,
  newSessionStats,
  renderCharacter,
  renderFooter,
  type ThemeLike,
  xpBar,
} from "./hud.ts";

// A theme stub that returns text unstyled, so we can assert on plain content.
const theme: ThemeLike = {
  fg: (_c: string, s: string) => s,
  bold: (s: string) => s,
  italic: (s: string) => s,
};

describe("hud formatting", () => {
  it("fmt compacts large numbers", () => {
    expect(fmt(42)).toBe("42");
    expect(fmt(1234)).toBe("1.2k");
    expect(fmt(2_500_000)).toBe("2.5M");
  });

  it("xpBar fills proportionally and respects width", () => {
    expect(xpBar(0.5, 10, theme)).toBe("█████░░░░░");
    expect(xpBar(0, 4, theme)).toBe("░░░░");
    expect(xpBar(1, 4, theme)).toBe("████");
  });

  it("footer is a single line fitting the width, showing character + cores", () => {
    const s = { ...defaultState(0), cores: 1500 };
    const [line] = renderFooter(
      s,
      { ...newSessionStats(), tokensOut: 2000, lastTps: 40 },
      "deepseek-v4-flash",
      "main",
      theme,
      120,
    );
    expect(line).toContain("Vanguard");
    expect(line).toContain("⬡1.5k");
    expect(line).toContain("40tk/s");
    // visible length never exceeds the width
    expect(line.length).toBeLessThanOrEqual(120);
  });

  it("character widget shows name, stars, affinity and a voice line", () => {
    const s = defaultState(0);
    const lines = renderCharacter(s, "Cleanly done, Commander.", theme);
    expect(lines[0]).toContain("Vanguard");
    expect(lines[0]).toContain("★★★★");
    expect(lines[1]).toContain("Cleanly done, Commander.");
  });
});
