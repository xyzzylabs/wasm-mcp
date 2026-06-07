// Pure query logic for the instruction index, shared by the stdio
// server and (later) the Cloudflare Worker so both rank and filter
// identically. Dependency-free — no node:fs, no parser imports — so
// the Worker can bundle it directly. Callers pass in the already
// loaded instruction records.

import type { InstructionRecord, InstructionCategory } from "../parser/instructions.js";

/** A lightweight row returned by list / search (no signature/anchors). */
export interface InstructionSummary {
  mnemonic: string;
  opcodes: number[];
  category: InstructionCategory;
  version: string;
  /** Whether this instruction can trap at runtime (see instruction_get for conditions). */
  can_trap: boolean;
}

export function toSummary(r: InstructionRecord): InstructionSummary {
  return {
    mnemonic: r.mnemonic,
    opcodes: r.opcodes,
    category: r.category,
    version: r.version,
    can_trap: r.can_trap,
  };
}

/** Format a byte array as the conventional space-separated hex string,
 *  e.g. `[0xFD, 0x89, 0x02]` → `"0xfd 0x89 0x02"`. */
export function formatOpcode(opcodes: number[]): string {
  return opcodes.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" ");
}

/** Parse a user-supplied opcode string into a byte array. Accepts
 *  `"0x6a"`, `"6a"`, `"0xFD 0x89 0x02"`, `"fd 89 02"`, `"fd,89,02"`.
 *  Returns null if any token isn't a 0–255 hex byte. */
export function parseOpcodeQuery(input: string): number[] | null {
  const tokens = input
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  const bytes: number[] = [];
  for (const tok of tokens) {
    const hex = tok.startsWith("0x") ? tok.slice(2) : tok;
    if (!/^[0-9a-f]{1,2}$/.test(hex)) return null;
    bytes.push(parseInt(hex, 16));
  }
  return bytes;
}

function opcodesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Look up one instruction by mnemonic (exact, case-insensitive) or
 * by binary opcode. Mnemonic is tried first; if the query parses as
 * a byte sequence, an exact opcode match is tried too. Returns the
 * matched record or null.
 */
export function getInstruction(
  records: InstructionRecord[],
  query: { mnemonic?: string; opcode?: string },
): InstructionRecord | null {
  if (query.mnemonic !== undefined) {
    const needle = query.mnemonic.trim().toLowerCase();
    const byMnemonic = records.find((r) => r.mnemonic.toLowerCase() === needle);
    if (byMnemonic) return byMnemonic;
  }
  if (query.opcode !== undefined) {
    const bytes = parseOpcodeQuery(query.opcode);
    if (bytes) {
      const byOpcode = records.find((r) => opcodesEqual(r.opcodes, bytes));
      if (byOpcode) return byOpcode;
    }
  }
  return null;
}

export interface ListFilter {
  category?: InstructionCategory;
  version?: string;
  /** Substring matched against the mnemonic prefix, case-insensitive. */
  prefix?: string;
  /** When set, keep only instructions that can (true) / cannot (false) trap. */
  can_trap?: boolean;
}

/** Enumerate instructions, optionally filtered, sorted by opcode. */
export function listInstructions(
  records: InstructionRecord[],
  filter: ListFilter = {},
): InstructionSummary[] {
  let out = records;
  if (filter.category !== undefined) out = out.filter((r) => r.category === filter.category);
  if (filter.version !== undefined) out = out.filter((r) => r.version === filter.version);
  if (filter.prefix !== undefined) {
    const p = filter.prefix.toLowerCase();
    out = out.filter((r) => r.mnemonic.toLowerCase().startsWith(p));
  }
  if (filter.can_trap !== undefined) out = out.filter((r) => r.can_trap === filter.can_trap);
  return [...out]
    .sort((a, b) => compareOpcodes(a.opcodes, b.opcodes))
    .map(toSummary);
}

function compareOpcodes(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i]! !== b[i]!) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}

export interface InstructionSearchHit extends InstructionSummary {
  /** Which field produced the strongest match. */
  matched_on: "mnemonic-exact" | "mnemonic-substring" | "category" | "opcode";
  /** Relevance score (0–100). Higher = stronger. */
  score: number;
}

/**
 * Search instructions by free-text query. Matches the mnemonic
 * (exact > substring), the category name, and the formatted opcode.
 * Ranked highest-first; ties broken by opcode order.
 */
export function searchInstructions(
  records: InstructionRecord[],
  query: string,
  limit = 20,
): InstructionSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const opcodeBytes = parseOpcodeQuery(q);

  const hits: InstructionSearchHit[] = [];
  for (const r of records) {
    const mn = r.mnemonic.toLowerCase();
    let matched_on: InstructionSearchHit["matched_on"] | null = null;
    let score = 0;

    if (mn === q) {
      matched_on = "mnemonic-exact";
      score = 100;
    } else if (mn.includes(q)) {
      matched_on = "mnemonic-substring";
      // Earlier matches rank higher; shorter mnemonics rank higher.
      score = 70 - mn.indexOf(q) - Math.min(20, mn.length - q.length);
    } else if (r.category === q) {
      matched_on = "category";
      score = 40;
    } else if (opcodeBytes && opcodesEqual(r.opcodes, opcodeBytes)) {
      matched_on = "opcode";
      score = 90;
    }

    if (matched_on) hits.push({ ...toSummary(r), matched_on, score });
  }

  hits.sort((a, b) => b.score - a.score || compareOpcodes(a.opcodes, b.opcodes));
  return hits.slice(0, limit);
}
