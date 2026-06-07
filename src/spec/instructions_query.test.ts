import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import {
  getInstruction,
  listInstructions,
  searchInstructions,
  parseOpcodeQuery,
  formatOpcode,
  toSummary,
} from "./instructions_query.js";
import type { InstructionRecord } from "../parser/instructions.js";

function loadRecords(): InstructionRecord[] {
  const snap = JSON.parse(
    readFileSync(resolve(BUILD_DIR, "wasm-spec-core-main.json"), "utf8"),
  ) as { instructions: InstructionRecord[] };
  return snap.instructions;
}

const records = loadRecords();

describe("parseOpcodeQuery", () => {
  it("parses 0x-prefixed and bare hex", () => {
    expect(parseOpcodeQuery("0x6a")).toEqual([0x6a]);
    expect(parseOpcodeQuery("6a")).toEqual([0x6a]);
  });
  it("parses multi-byte separated by space or comma", () => {
    expect(parseOpcodeQuery("0xfd 0x89 0x02")).toEqual([0xfd, 0x89, 0x02]);
    expect(parseOpcodeQuery("fd,89,02")).toEqual([0xfd, 0x89, 0x02]);
  });
  it("rejects non-hex / out-of-range", () => {
    expect(parseOpcodeQuery("zz")).toBeNull();
    expect(parseOpcodeQuery("0x1ff")).toBeNull();
    expect(parseOpcodeQuery("")).toBeNull();
  });
});

describe("formatOpcode", () => {
  it("formats bytes as zero-padded hex", () => {
    expect(formatOpcode([0x6a])).toBe("0x6a");
    expect(formatOpcode([0xfd, 0x89, 0x02])).toBe("0xfd 0x89 0x02");
    expect(formatOpcode([0x00])).toBe("0x00");
  });
});

describe("getInstruction", () => {
  it("finds i32.add by mnemonic (case-insensitive)", () => {
    const r = getInstruction(records, { mnemonic: "I32.ADD" });
    expect(r?.mnemonic).toBe("i32.add");
    expect(r?.opcodes).toEqual([0x6a]);
    expect(r?.category).toBe("numeric");
  });
  it("finds br_if by opcode 0x0d", () => {
    const r = getInstruction(records, { opcode: "0x0d" });
    expect(r?.mnemonic).toBe("br_if");
  });
  it("finds a multi-byte vector instruction by opcode", () => {
    const r = getInstruction(records, { opcode: "0xfd 0x89 0x02" });
    expect(r?.category).toBe("vec");
    expect(r?.opcodes).toEqual([0xfd, 0x89, 0x02]);
  });
  it("returns null for unknown", () => {
    expect(getInstruction(records, { mnemonic: "i32.nonexistent" })).toBeNull();
    expect(getInstruction(records, {})).toBeNull();
  });
  it("prefers mnemonic over opcode when both given and mnemonic matches", () => {
    const r = getInstruction(records, { mnemonic: "nop", opcode: "0x6a" });
    expect(r?.mnemonic).toBe("nop");
  });
});

describe("listInstructions", () => {
  it("filters by category and sorts by opcode", () => {
    const control = listInstructions(records, { category: "control" });
    expect(control.length).toBeGreaterThan(5);
    expect(control.every((r) => r.category === "control")).toBe(true);
    // unreachable (0x00) sorts before nop (0x01) before block (0x02).
    expect(control[0]!.mnemonic).toBe("unreachable");
  });
  it("filters by introducing version", () => {
    const v3 = listInstructions(records, { version: "3.0" });
    expect(v3.length).toBeGreaterThan(0);
    expect(v3.every((r) => r.version === "3.0")).toBe(true);
  });
  it("filters by mnemonic prefix", () => {
    const i32 = listInstructions(records, { prefix: "i32." });
    expect(i32.length).toBeGreaterThan(10);
    expect(i32.every((r) => r.mnemonic.startsWith("i32."))).toBe(true);
  });
  it("returns all when no filter", () => {
    expect(listInstructions(records).length).toBe(records.length);
  });
});

describe("searchInstructions", () => {
  it("ranks exact mnemonic first", () => {
    const hits = searchInstructions(records, "i32.add");
    expect(hits[0]!.mnemonic).toBe("i32.add");
    expect(hits[0]!.matched_on).toBe("mnemonic-exact");
    expect(hits[0]!.score).toBe(100);
  });
  it("surfaces extend family via substring", () => {
    const hits = searchInstructions(records, "extend");
    expect(hits.length).toBeGreaterThan(2);
    expect(hits.every((h) => h.mnemonic.includes("extend"))).toBe(true);
  });
  it("matches by opcode hex", () => {
    const hits = searchInstructions(records, "0x6a");
    expect(hits[0]!.mnemonic).toBe("i32.add");
    expect(hits[0]!.matched_on).toBe("opcode");
  });
  it("respects limit", () => {
    expect(searchInstructions(records, "i", 5).length).toBeLessThanOrEqual(5);
  });
  it("returns empty for blank query", () => {
    expect(searchInstructions(records, "   ")).toEqual([]);
  });
});

describe("toSummary", () => {
  it("drops signature and anchors", () => {
    const r = records.find((x) => x.mnemonic === "i32.add")!;
    const s = toSummary(r);
    expect(s).toEqual({
      mnemonic: "i32.add",
      opcodes: [0x6a],
      category: "numeric",
      version: "1.0",
      can_trap: false,
    });
    expect("signature" in s).toBe(false);
  });
});
