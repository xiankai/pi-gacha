import { describe, expect, it } from "vitest";
import { buildPersona, deriveMood } from "./persona.ts";

describe("deriveMood", () => {
  it("is strained after repeated errors", () => {
    expect(deriveMood(0, 2)).toBe("strained");
    expect(deriveMood(0, 5)).toBe("strained");
  });
  it("is confident after a success streak", () => {
    expect(deriveMood(3, 0)).toBe("confident");
  });
  it("is neutral otherwise", () => {
    expect(deriveMood(1, 0)).toBe("neutral");
    expect(deriveMood(0, 1)).toBe("neutral");
  });
});

describe("buildPersona", () => {
  it("includes the character name, persona text, and the always-finish guardrail", () => {
    const p = buildPersona("vanguard", 0, "neutral");
    expect(p).toContain("Vanguard");
    expect(p).toContain("Commander");
    expect(p.toLowerCase()).toContain("never let flavor");
  });

  it("adds warmth flavor at high affinity", () => {
    expect(buildPersona("vanguard", 60, "neutral")).toContain("long history");
    expect(buildPersona("vanguard", 25, "neutral")).toContain(
      "growing comfortable",
    );
  });

  it("reflects mood", () => {
    expect(buildPersona("sentinel", 0, "confident")).toContain("smoothly");
    expect(buildPersona("sentinel", 0, "strained")).toContain("steady");
  });

  it("returns empty for an unknown character", () => {
    expect(buildPersona("nobody", 0, "neutral")).toBe("");
  });
});
