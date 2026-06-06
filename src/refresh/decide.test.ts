import { describe, it, expect } from "vitest";
import { decideRefresh, bumpPatch } from "./decide.js";

describe("decideRefresh", () => {
  it("reports no refresh when SHAs match", () => {
    const d = decideRefresh({ "spec/main": "aaa" }, { "spec/main": "aaa" });
    expect(d.needsRefresh).toBe(false);
    expect(d.moved).toEqual([]);
  });

  it("detects a moved pin", () => {
    const d = decideRefresh(
      { "spec/main": "aaa", "proposals/main": "bbb" },
      { "spec/main": "ccc", "proposals/main": "bbb" },
    );
    expect(d.needsRefresh).toBe(true);
    expect(d.moved).toEqual([{ key: "spec/main", from: "aaa", to: "ccc" }]);
  });

  it("ignores keys missing from upstream (failed lookup)", () => {
    const d = decideRefresh({ "spec/main": "aaa" }, {});
    expect(d.needsRefresh).toBe(false);
  });
});

describe("bumpPatch", () => {
  it("bumps the patch component", () => {
    expect(bumpPatch("0.1.0")).toBe("0.1.1");
    expect(bumpPatch("1.2.9")).toBe("1.2.10");
  });
  it("drops pre-release metadata", () => {
    expect(bumpPatch("0.1.0-beta.1")).toBe("0.1.1");
  });
  it("throws on malformed input", () => {
    expect(() => bumpPatch("nope")).toThrow();
  });
});
