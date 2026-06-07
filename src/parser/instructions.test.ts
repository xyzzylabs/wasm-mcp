import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  parseOpcode,
  parseSignature,
  resolveMnemonic,
  resolveCategory,
  instructionUrl,
  normalizeInstructions,
  InstructionRecordSchema,
  type RawDump,
} from "./instructions.js";
import { extractRawDump } from "./upstream.js";
import { VENDOR_ROOT } from "../paths.js";

function loadDump(): RawDump {
  return extractRawDump(resolve(VENDOR_ROOT, "wasm-spec-main"));
}

describe("parseOpcode", () => {
  it("parses single-byte hex", () => {
    expect(parseOpcode("\\hex{00}")).toEqual([0x00]);
    expect(parseOpcode("\\hex{6A}")).toEqual([0x6a]);
  });

  it("parses multi-byte vector prefix", () => {
    expect(parseOpcode("\\hex{FD}~~\\hex{89}~~\\hex{02}")).toEqual([0xfd, 0x89, 0x02]);
  });

  it("returns empty array when no \\hex tokens", () => {
    expect(parseOpcode("(reserved)")).toEqual([]);
  });
});

describe("parseSignature", () => {
  it("splits on \\to", () => {
    const sig = parseSignature("[t_1^\\ast~\\I32] \\to [t_2^\\ast]");
    expect(sig.params_raw).toBe("[t_1^\\ast~\\I32]");
    expect(sig.results_raw).toBe("[t_2^\\ast]");
  });
});

describe("instructionUrl", () => {
  it("routes valid- anchors to valid/instructions.html", () => {
    expect(instructionUrl("valid-br_if")).toBe(
      "https://webassembly.github.io/spec/core/valid/instructions.html#valid-br_if",
    );
  });
  it("routes exec- anchors to exec/instructions.html", () => {
    expect(instructionUrl("exec-i32.add")).toBe(
      "https://webassembly.github.io/spec/core/exec/instructions.html#exec-i32.add",
    );
  });
});

describe("resolveMnemonic + resolveCategory (on pinned dump)", () => {
  const dump = loadDump();

  it.each([
    ["\\UNREACHABLE", "unreachable", "control"],
    ["\\NOP", "nop", "control"],
    ["\\BLOCK~\\X{bt}", "block", "control"],
    ["\\BRIF~l", "br_if", "control"],
    ["\\CALLINDIRECT~x~y", "call_indirect", "control"],
    ["\\RETURNCALLREF~x", "return_call_ref", "control"],
    ["\\LOCALGET~x", "local.get", "variable"],
    ["\\GLOBALSET~x", "global.set", "variable"],
    ["\\TABLEFILL~x", "table.fill", "table"],
  ])("%s → %s (%s)", (latex, mnemonic, category) => {
    expect(resolveMnemonic(latex, dump.macros)).toBe(mnemonic);
    expect(resolveCategory(latex, dump.macros)).toBe(category);
  });
});

describe("normalizeInstructions (pinned dump)", () => {
  const dump = loadDump();
  const { records, skipped } = normalizeInstructions(dump);

  it("yields at least 400 active instructions", () => {
    expect(records.length).toBeGreaterThanOrEqual(400);
  });

  it("skips reserved opcodes (counted, not errored)", () => {
    expect(skipped.reserved).toBeGreaterThan(0);
  });

  it("every record passes the InstructionRecordSchema", () => {
    for (const r of records) {
      expect(() => InstructionRecordSchema.parse(r)).not.toThrow();
    }
  });

  it("includes well-known control / numeric / memory instructions", () => {
    const mnemonics = new Set(records.map((r) => r.mnemonic));
    for (const expected of [
      "unreachable",
      "nop",
      "br",
      "br_if",
      "br_table",
      "return",
      "call",
      "call_indirect",
      "drop",
      "select",
      "local.get",
      "local.set",
      "local.tee",
      "global.get",
      "global.set",
    ]) {
      expect(mnemonics.has(expected), `missing: ${expected}`).toBe(true);
    }
  });

  it("opcodes are byte-valued and non-empty", () => {
    for (const r of records) {
      expect(r.opcodes.length).toBeGreaterThan(0);
      for (const b of r.opcodes) {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(0xff);
      }
    }
  });
});
