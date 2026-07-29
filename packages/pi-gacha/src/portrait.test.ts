import { describe, expect, it } from "vitest";
import { renderPortrait } from "./portrait.ts";

describe("renderPortrait", () => {
  it("renders 4 half-block rows of truecolor ANSI for a known character", () => {
    const lines = renderPortrait("vanguard");
    expect(lines).toHaveLength(4);
    // contains 24-bit color escapes and half-block glyphs
    expect(lines.join("")).toContain("\x1b[38;2;");
    expect(lines.join("")).toMatch(/[▀▄]/u);
  });

  it("differs between characters (palette recolor)", () => {
    expect(renderPortrait("vanguard").join("")).not.toBe(
      renderPortrait("sentinel").join(""),
    );
  });

  it("returns empty for an unknown character", () => {
    expect(renderPortrait("nobody")).toEqual([]);
  });
});
