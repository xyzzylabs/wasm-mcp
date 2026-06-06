import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { getClause, listSections, searchSpec } from "./sections_query.js";
import type { SpecClause } from "../parser/sections.js";

function loadSections(): SpecClause[] {
  const snap = JSON.parse(
    readFileSync(resolve(BUILD_DIR, "wasm-spec-core-main.json"), "utf8"),
  ) as { sections: SpecClause[] };
  return snap.sections;
}

const sections = loadSections();

describe("getClause", () => {
  it("finds a clause by anchor", () => {
    const c = getClause(sections, "syntax-numtype");
    expect(c?.title).toBe("Number Types");
    expect(c?.path).toBe("syntax/types");
    expect(c?.url).toContain("#syntax-numtype");
  });
  it("finds an anchor-only exec block", () => {
    const c = getClause(sections, "exec-nop");
    expect(c).not.toBeNull();
    expect(c?.formal_refs).toContain("Step_pure/nop");
  });
  it("is case-insensitive as a fallback", () => {
    expect(getClause(sections, "SYNTAX-NUMTYPE")?.title).toBe("Number Types");
  });
  it("returns null for unknown anchor", () => {
    expect(getClause(sections, "no-such-anchor")).toBeNull();
  });
});

describe("listSections", () => {
  it("filters by top-level path", () => {
    const binary = listSections(sections, { path: "binary" });
    expect(binary.length).toBeGreaterThan(10);
    expect(binary.every((s) => s.path === "binary" || s.path.startsWith("binary/"))).toBe(true);
  });
  it("filters by sub-path", () => {
    const types = listSections(sections, { path: "syntax/types" });
    expect(types.every((s) => s.path === "syntax/types")).toBe(true);
  });
  it("filters by anchor prefix", () => {
    const valid = listSections(sections, { anchor_prefix: "valid-" });
    expect(valid.length).toBeGreaterThan(20);
    expect(
      valid.every((s) => s.id.startsWith("valid-") || s.anchors.some((a) => a.startsWith("valid-"))),
    ).toBe(true);
  });
  it("titled_only drops anchor-only blocks", () => {
    const titled = listSections(sections, { path: "exec", titled_only: true });
    expect(titled.every((s) => s.title !== null)).toBe(true);
  });
});

describe("searchSpec", () => {
  it("ranks title matches and finds block types", () => {
    const hits = searchSpec(sections, "block type");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.anchors.includes("syntax-blocktype"))).toBe(true);
  });
  it("matches prose with a snippet", () => {
    const hits = searchSpec(sections, "trap");
    expect(hits.length).toBeGreaterThan(0);
    const proseHit = hits.find((h) => h.matched_on === "prose");
    if (proseHit) expect(proseHit.snippet).toBeTruthy();
  });
  it("exact anchor match scores highest", () => {
    const hits = searchSpec(sections, "syntax-numtype");
    expect(hits[0]!.matched_on).toBe("anchor-exact");
    expect(hits[0]!.score).toBe(100);
  });
  it("respects limit and empty query", () => {
    expect(searchSpec(sections, "type", 5).length).toBeLessThanOrEqual(5);
    expect(searchSpec(sections, "  ")).toEqual([]);
  });
});
