import { describe, it, expect } from "vitest";
import { instructionGet } from "./instruction_get.js";
import { instructionList } from "./instruction_list.js";
import { instructionSearch } from "./instruction_search.js";

// These exercise the full path through the runtime data loader,
// reading the baked build/wasm-spec-core-main.json artifact.

describe("instruction_get tool", () => {
  it("returns the full record for i32.add", () => {
    const r = instructionGet({ mnemonic: "i32.add" });
    expect(r).not.toBeNull();
    expect(r!.opcodes).toEqual([0x6a]);
    expect(r!.signature.params_raw).toContain("\\I32");
    expect(r!.urls.validation).toMatch(/^https:\/\/webassembly\.github\.io\/spec\/core\//);
    expect(r!.urls.execution).toMatch(/#exec-/);
  });

  it("looks up by opcode", () => {
    expect(instructionGet({ opcode: "0x01" })!.mnemonic).toBe("nop");
  });

  it("returns null with no selector", () => {
    expect(instructionGet({})).toBeNull();
  });
});

describe("instruction_list tool", () => {
  it("counts match the returned rows", () => {
    const r = instructionList({ category: "numeric" });
    expect(r.count).toBe(r.instructions.length);
    expect(r.count).toBeGreaterThan(20);
  });

  it("combines category + introduced_in", () => {
    const r = instructionList({ category: "vec", introduced_in: "3.0" });
    expect(r.instructions.every((i) => i.category === "vec" && i.version === "3.0")).toBe(true);
  });
});

describe("instruction_search tool", () => {
  it("wraps ranked hits with a count", () => {
    const r = instructionSearch({ query: "trunc" });
    expect(r.count).toBe(r.hits.length);
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it("honours an explicit limit", () => {
    const r = instructionSearch({ query: "i64", limit: 3 });
    expect(r.hits.length).toBeLessThanOrEqual(3);
  });
});
