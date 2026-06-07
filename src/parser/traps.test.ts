import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { deriveTraps } from "./traps.js";
import type { InstructionRecord } from "./instructions.js";

const names = (m: string) => deriveTraps(m).map((t) => t.name);

describe("deriveTraps (unit)", () => {
  it("integer division / remainder", () => {
    expect(names("i32.div_s")).toEqual(["integer divide by zero", "integer overflow"]);
    expect(names("i64.div_s")).toEqual(["integer divide by zero", "integer overflow"]);
    expect(names("i32.div_u")).toEqual(["integer divide by zero"]);
    // rem_s does NOT overflow (INT_MIN % -1 == 0).
    expect(names("i32.rem_s")).toEqual(["integer divide by zero"]);
    expect(names("i64.rem_u")).toEqual(["integer divide by zero"]);
  });

  it("non-saturating truncation traps; saturating does not", () => {
    expect(names("i32.trunc_f32_s")).toEqual(["invalid conversion to integer", "integer overflow"]);
    expect(names("i64.trunc_f64_u")).toEqual(["invalid conversion to integer", "integer overflow"]);
    expect(deriveTraps("i32.trunc_sat_f32_s")).toEqual([]);
    expect(deriveTraps("i32.trunc_sat_f64_u")).toEqual([]);
  });

  it("memory accesses (incl. SIMD lane/splat) trap OOB", () => {
    for (const m of ["i32.load", "i64.load8_s", "f64.store", "v128.load32_zero", "v128.store8_lane"]) {
      expect(names(m), m).toEqual(["out of bounds memory access"]);
    }
    expect(names("memory.fill")).toEqual(["out of bounds memory access"]);
    // size/grow never trap.
    expect(deriveTraps("memory.size")).toEqual([]);
    expect(deriveTraps("memory.grow")).toEqual([]);
  });

  it("table accesses trap; size/grow do not", () => {
    expect(names("table.get")).toEqual(["out of bounds table access"]);
    expect(names("table.copy")).toEqual(["out of bounds table access"]);
    expect(deriveTraps("table.size")).toEqual([]);
    expect(deriveTraps("table.grow")).toEqual([]);
  });

  it("call_indirect has the three indirect-call traps", () => {
    expect(names("call_indirect")).toEqual([
      "undefined element",
      "uninitialized element",
      "indirect call type mismatch",
    ]);
  });

  it("unreachable always traps", () => {
    const t = deriveTraps("unreachable");
    expect(t).toHaveLength(1);
    expect(t[0]!.name).toBe("unreachable");
  });

  it("single null-dereference reference instructions", () => {
    expect(names("ref.as_non_null")).toEqual(["null reference"]);
    expect(names("call_ref")).toEqual(["null reference"]);
    expect(names("struct.get")).toEqual(["null reference"]);
    expect(names("struct.set")).toEqual(["null reference"]);
  });

  it("non-trapping instructions return empty", () => {
    for (const m of ["i32.add", "i32.eqz", "local.get", "global.set", "f32.sqrt", "i32.wrap_i64", "drop"]) {
      expect(deriveTraps(m), m).toEqual([]);
    }
  });
});

describe("traps in the baked artifact (pinned build)", () => {
  const instructions = (
    JSON.parse(readFileSync(resolve(BUILD_DIR, "wasm-spec-core-main.json"), "utf8")) as {
      instructions: InstructionRecord[];
    }
  ).instructions;
  const byM = new Map(instructions.map((r) => [r.mnemonic, r]));

  it("acceptance cases", () => {
    expect(byM.get("i32.div_s")!.traps).toEqual([
      { condition: "divisor is zero", name: "integer divide by zero" },
      { condition: "signed overflow (INT_MIN / -1)", name: "integer overflow" },
    ]);
    expect(byM.get("i32.trunc_sat_f32_s")!.can_trap).toBe(false);
    expect(byM.get("i32.trunc_sat_f32_s")!.traps).toEqual([]);
    expect(byM.get("i32.load")!.traps[0]!.name).toBe("out of bounds memory access");
    expect(byM.get("call_indirect")!.traps).toHaveLength(3);
    expect(byM.get("unreachable")!.can_trap).toBe(true);
    expect(byM.get("i32.add")!.can_trap).toBe(false);
    expect(byM.get("i32.add")!.traps).toEqual([]);
  });

  it("can_trap mirrors traps non-emptiness for every instruction", () => {
    for (const r of instructions) {
      expect(r.can_trap, r.mnemonic).toBe(r.traps.length > 0);
    }
  });

  it("every trap name is from the canonical set", () => {
    const canonical = new Set([
      "integer divide by zero",
      "integer overflow",
      "invalid conversion to integer",
      "out of bounds memory access",
      "out of bounds table access",
      "undefined element",
      "uninitialized element",
      "indirect call type mismatch",
      "unreachable",
      "null reference",
    ]);
    for (const r of instructions) {
      for (const t of r.traps) expect(canonical.has(t.name), `${r.mnemonic}: ${t.name}`).toBe(true);
    }
  });
});
