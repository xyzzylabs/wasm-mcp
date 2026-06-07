// Extract the structured instruction index + macro table from the
// upstream WebAssembly/spec sources — a pure-TypeScript replacement
// for the old scripts/dump-instructions.py, so the build needs no
// Python toolchain.
//
// Two upstream files are read:
//
//   document/core/appendix/index-instructions.py
//     The structured source for the appendix instruction table. We do
//     NOT execute it; we parse the literal `INSTRUCTIONS = [ ... ]`
//     list of `Instruction(...)` calls. Each entry's args are simple
//     Python literals — raw strings (`r'...'`), floats, `None`, and
//     keyword args — with no nested calls, escaped quotes, or
//     in-string commas (verified against the pinned source).
//
//   document/core/util/macros.def
//     reStructuredText `|MACRO| mathdef:: \xref{section}{anchor}
//     {\K{body}}` lines. The `\K{...}` body is the rendered mnemonic
//     / type string; the anchor gives the category.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RawInstruction, RawMacro, RawDump } from "./instructions.js";

export type { RawInstruction, RawMacro, RawDump } from "./instructions.js";

const INSTRUCTION_KEYS: (keyof RawInstruction)[] = [
  "version",
  "name",
  "opcode",
  "type",
  "validation",
  "execution",
  "operator",
  "validation2",
  "execution2",
];

// ─── index-instructions.py ──────────────────────────────────────────

const QUOTES = new Set(["'", '"']);

/**
 * Slice out the body of the `INSTRUCTIONS = [ ... ]` list, scanning
 * for the matching `]` while ignoring brackets inside string literals.
 * Upstream uses both `r'...'` and `r"..."` raw strings (the latter
 * when the content contains a single quote), so quote tracking keys
 * off whichever quote opened the current string.
 */
function sliceInstructionsList(source: string): string {
  const marker = "INSTRUCTIONS = [";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("INSTRUCTIONS list not found in index-instructions.py");
  let i = start + marker.length;
  let depth = 1;
  let quote: string | null = null;
  for (; i < source.length; i++) {
    const c = source[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (QUOTES.has(c)) quote = c;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return source.slice(start + marker.length, i);
    }
  }
  throw new Error("Unterminated INSTRUCTIONS list");
}

/** Extract the inner-argument text of each `Instruction(...)` call. */
function instructionCallArgs(listBody: string): string[] {
  const calls: string[] = [];
  const marker = "Instruction(";
  let idx = 0;
  while ((idx = listBody.indexOf(marker, idx)) >= 0) {
    let i = idx + marker.length;
    let depth = 1;
    let quote: string | null = null;
    const argStart = i;
    for (; i < listBody.length; i++) {
      const c = listBody[i]!;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (QUOTES.has(c)) quote = c;
      else if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push(listBody.slice(argStart, i));
    idx = i + 1;
  }
  return calls;
}

/** Split an argument list on top-level commas (ignoring those inside
 *  string literals of either quote style). */
function splitArgs(argText: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < argText.length; i++) {
    const c = argText[i]!;
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (QUOTES.has(c)) {
      quote = c;
      cur += c;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

/** Parse a single Python literal arg value: raw/plain string (either
 *  quote style), float, or None. */
function parseValue(tokenRaw: string): string | number | null {
  const token = tokenRaw.trim();
  if (token === "None") return null;
  // String: optional `r` prefix, then '...' or "...".
  const m = token.match(/^r?(['"])([\s\S]*)\1$/);
  if (m) return m[2]!;
  const num = Number(token);
  if (!Number.isNaN(num)) return num;
  throw new Error(`Unparseable Instruction arg: ${tokenRaw}`);
}

export function parseInstructions(source: string): RawInstruction[] {
  const listBody = sliceInstructionsList(source);
  const out: RawInstruction[] = [];
  for (const callArgs of instructionCallArgs(listBody)) {
    const rec: RawInstruction = {
      version: null,
      name: null,
      opcode: null,
      type: null,
      validation: null,
      execution: null,
      operator: null,
      validation2: null,
      execution2: null,
    };
    let positional = 0;
    for (const argRaw of splitArgs(callArgs)) {
      const arg = argRaw.trim();
      if (arg === "") continue;
      // Keyword arg? `name=value` where name is a bare identifier.
      const kw = arg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
      if (kw && !kw[1]!.startsWith("r'")) {
        const key = kw[1] as keyof RawInstruction;
        if (key in rec) rec[key] = parseValue(kw[2]!) as never;
        continue;
      }
      const key = INSTRUCTION_KEYS[positional++];
      if (key) rec[key] = parseValue(arg) as never;
    }
    out.push(rec);
  }
  return out;
}

// ─── macros.def ─────────────────────────────────────────────────────

// `.. |NAME| mathdef:: \xref{section}{anchor}{\K{body}}` — body may
// nest one level of braces (e.g. `\K{local{.}get}`).
const MACRO_RE =
  /^\.\.\s+\|([A-Z0-9]+)\|\s+mathdef::\s+\\xref\{([^}]+)\}\{([^}]+)\}\{\\K\{((?:[^{}]+|\{[^{}]*\})+)\}\}\s*$/;

const TYPE_ANCHORS = new Set([
  "syntax-numtype",
  "syntax-vectype",
  "syntax-reftype",
  "syntax-valtype",
  "syntax-shape",
]);

function cleanBody(body: string): string {
  let cleaned = body.replace(/\\_/g, "_").replace(/\{\.\}/g, ".");
  cleaned = cleaned.replace(/\\scriptstyle\s*/g, "");
  cleaned = cleaned.replace(/\\;/g, "");
  cleaned = cleaned.replace(/\{(\d+)\}/g, "$1");
  return cleaned;
}

export function parseMacros(text: string): Record<string, RawMacro> {
  const macros: Record<string, RawMacro> = {};
  for (const line of text.split("\n")) {
    const m = line.match(MACRO_RE);
    if (!m) continue;
    const [, name, section, anchor, bodyRaw] = m;
    let kind: RawMacro["kind"] = "other";
    let category: string | null = null;
    if (anchor!.startsWith("syntax-instr-")) {
      kind = "instruction";
      category = anchor!.slice("syntax-instr-".length);
    } else if (TYPE_ANCHORS.has(anchor!)) {
      kind = "type";
    }
    macros[name!] = { body: cleanBody(bodyRaw!), kind, category, section: section!, anchor: anchor! };
  }
  return macros;
}

// ─── driver ─────────────────────────────────────────────────────────

/** Read both upstream files from a vendored checkout and produce the
 *  combined raw dump. */
export function extractRawDump(snapshotDir: string): RawDump {
  const instrPath = resolve(snapshotDir, "document/core/appendix/index-instructions.py");
  const macrosPath = resolve(snapshotDir, "document/core/util/macros.def");
  return {
    instructions: parseInstructions(readFileSync(instrPath, "utf8")),
    macros: parseMacros(readFileSync(macrosPath, "utf8")),
  };
}
