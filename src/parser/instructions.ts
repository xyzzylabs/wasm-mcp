// Normalise the raw instruction + macro JSON dumped by
// `scripts/dump-instructions.py` into clean, agent-friendly
// `InstructionRecord`s.
//
// The upstream `index-instructions.py` uses LaTeX macros for
// readability ("\I32.\ADD", "\hex{0C}", "[t_1^\ast~\I32] \to [t_2^\ast]").
// The macro table in `util/macros.def` defines the mathdef → mnemonic
// mapping ("\BRIF" → `br_if`, with category `control`). This module
// joins the two and emits a stable record shape that the runtime
// tools query directly — no LaTeX in the surface area.

import { z } from "zod";

export const INSTRUCTION_CATEGORIES = [
  "control",
  "numeric",
  "parametric",
  "variable",
  "table",
  "memory",
  "ref",
  "i31",
  "struct",
  "array",
  "extern",
  "vec",
] as const;
export type InstructionCategory = (typeof INSTRUCTION_CATEGORIES)[number];

export const WASM_VERSIONS = ["1.0", "2.0", "3.0"] as const;
export type WasmVersion = (typeof WASM_VERSIONS)[number];

/** A single instruction record exposed by the MCP tools. */
export interface InstructionRecord {
  /** Lowercase wasm syntax mnemonic, e.g. `"i32.add"`, `"br_if"`. */
  mnemonic: string;
  /**
   * Binary opcode encoding as a byte sequence. Single-byte for
   * classic opcodes (`[0x6A]` for `i32.add`); multi-byte for
   * prefix-encoded families (`[0xFD, 0x89, 0x02]` for vector
   * `i8x16.relaxed_laneselect`).
   */
  opcodes: number[];
  /** Spec category this instruction belongs to. */
  category: InstructionCategory;
  /**
   * Minimum spec version that introduced this instruction.
   * `"1.0"` (MVP), `"2.0"` (Wasm 2), `"3.0"` (Wasm 3 — exception
   * handling, GC, threads, tail calls, relaxed SIMD).
   */
  version: WasmVersion;
  /**
   * Stack type signature. `params_raw` / `results_raw` are the raw
   * LaTeX strings as upstream wrote them (e.g. `"[t_1^\\ast~\\I32]"`);
   * the runtime keeps them verbatim because the full stack-type
   * grammar (polymorphic, type variables, vector splats) is richer
   * than a flat list. A future release may add a fully decoded
   * `params` / `results` alongside.
   */
  signature: {
    params_raw: string;
    results_raw: string;
  };
  /**
   * Fragment identifiers within the rendered spec — e.g.
   * `valid-br_if`, `exec-br_if`. Stable across spec releases.
   */
  anchors: {
    validation: string;
    execution: string;
  };
  /**
   * Full URLs into the rendered spec at
   * `https://webassembly.github.io/spec/core/`. Built from `anchors`
   * by `instructionUrl`.
   */
  urls: {
    validation: string;
    execution: string;
  };
}

export const InstructionRecordSchema = z.object({
  mnemonic: z.string(),
  opcodes: z.array(z.number().int().min(0).max(0xff)),
  category: z.enum(INSTRUCTION_CATEGORIES),
  version: z.enum(WASM_VERSIONS),
  signature: z.object({ params_raw: z.string(), results_raw: z.string() }),
  anchors: z.object({ validation: z.string(), execution: z.string() }),
  urls: z.object({ validation: z.url(), execution: z.url() }),
});

interface RawInstruction {
  version: number | null;
  name: string | null;
  opcode: string | null;
  type: string | null;
  validation: string | null;
  execution: string | null;
  operator: string | null;
  validation2: string | null;
  execution2: string | null;
}
interface RawMacro {
  body: string;
  kind: "instruction" | "type" | "other";
  category: string | null;
  section: string;
  anchor: string;
}
export interface RawDump {
  instructions: RawInstruction[];
  macros: Record<string, RawMacro>;
}

const SPEC_BASE = "https://webassembly.github.io/spec/core";

/** Build a full anchor URL into the rendered spec. */
export function instructionUrl(anchor: string): string {
  if (anchor.startsWith("valid-")) return `${SPEC_BASE}/valid/instructions.html#${anchor}`;
  if (anchor.startsWith("exec-")) return `${SPEC_BASE}/exec/instructions.html#${anchor}`;
  return `${SPEC_BASE}/#${anchor}`;
}

/** Parse `\hex{0C}` or `\hex{FD}~~\hex{89}~~\hex{02}` into a byte array. */
export function parseOpcode(latex: string): number[] {
  const bytes: number[] = [];
  const re = /\\hex\{([0-9A-Fa-f]+)\}/g;
  for (const m of latex.matchAll(re)) {
    bytes.push(parseInt(m[1]!, 16));
  }
  return bytes;
}

/**
 * Render one dot-separated segment of a LaTeX instruction name.
 *
 * A segment is a sequence of LaTeX tokens that together form one
 * piece of the mnemonic between dots — e.g. `\I32`, `\BRIF`, or the
 * compound `\LOAD\K{8\_s}` (which becomes `load8_s`). Tokens we
 * recognise:
 *
 *   `\MACRO`        Look up in the macro table; emit its `body`.
 *   `\K{...}`       Literal text (operator suffix). Emit with LaTeX
 *                   escapes stripped — `\_` → `_`, `{.}` → `.`.
 *
 * Unknown token shapes cause the segment to fail (returns null) so
 * the caller can report the upstream addition rather than silently
 * misnaming the instruction.
 */
function renderSegment(seg: string, macros: Record<string, RawMacro>): string | null {
  let i = 0;
  const out: string[] = [];
  while (i < seg.length) {
    if (seg[i] === " " || seg[i] === "\t") {
      i += 1;
      continue;
    }
    if (seg[i] !== "\\") return null;
    // `\K{...}` literal text run — read the body with one level of
    // nested-brace tolerance.
    if (seg.startsWith("\\K{", i)) {
      i += 3;
      let depth = 1;
      const start = i;
      while (i < seg.length && depth > 0) {
        if (seg[i] === "{") depth += 1;
        else if (seg[i] === "}") depth -= 1;
        if (depth > 0) i += 1;
      }
      if (depth !== 0) return null;
      const body = seg.slice(start, i);
      i += 1;
      out.push(body.replace(/\\_/g, "_").replace(/\{\.\}/g, "."));
      continue;
    }
    // `\MACRO` — capture identifier of letters/digits.
    const macroMatch = seg.slice(i).match(/^\\([A-Za-z0-9]+)/);
    if (!macroMatch) return null;
    const macro = macros[macroMatch[1]!];
    if (!macro) return null;
    out.push(macro.body);
    i += macroMatch[0].length;
  }
  if (out.length === 0) return null;
  return out.join("");
}

/**
 * Resolve a LaTeX name like `\I32.\ADD` or `\BR~l` into the wasm
 * syntax mnemonic. The leading `\` macros are expanded via the
 * macro table; everything from the first `~` onwards is dropped
 * (immediate operands aren't part of the mnemonic).
 */
export function resolveMnemonic(
  nameLatex: string,
  macros: Record<string, RawMacro>,
): string | null {
  // Drop immediates: `\BR~l` → `\BR`, `\IF~\X{bt}` → `\IF`.
  const headOnly = nameLatex.split("~")[0]!.trim();
  const rendered: string[] = [];
  for (const seg of headOnly.split(".")) {
    const trimmed = seg.trim();
    if (trimmed === "") continue;
    const piece = renderSegment(trimmed, macros);
    if (piece === null) return null;
    rendered.push(piece);
  }
  if (rendered.length === 0) return null;
  return rendered.join(".");
}

/** Split a `type` LaTeX string like `[a] \to [b]` into params/results. */
export function parseSignature(typeLatex: string): { params_raw: string; results_raw: string } {
  const parts = typeLatex.split(/\\to/);
  const lhs = (parts[0] ?? "").trim();
  const rhs = (parts[1] ?? "").trim();
  return { params_raw: lhs, results_raw: rhs };
}

/**
 * Resolve the category of an instruction by finding its primary
 * macro in the name and looking up its instruction-category tag.
 * For `\I32.\ADD` the primary macro is `\ADD` (an instruction macro);
 * `\I32` is a type macro and contributes no category.
 */
export function resolveCategory(
  nameLatex: string,
  macros: Record<string, RawMacro>,
): InstructionCategory | null {
  const headOnly = nameLatex.split("~")[0]!.trim();
  // Walk every `\MACRO` token in the head (across all dot-segments)
  // and return the first one whose macro is an instruction macro.
  // Type macros (`\I32`) carry no category — they're skipped — so
  // `\I32.\ADD` resolves via `\ADD` to `numeric`.
  for (const m of headOnly.matchAll(/\\([A-Za-z0-9]+)/g)) {
    const macro = macros[m[1]!];
    if (macro?.kind === "instruction" && macro.category) {
      const cat = macro.category as InstructionCategory;
      if ((INSTRUCTION_CATEGORIES as readonly string[]).includes(cat)) return cat;
    }
  }
  return null;
}

function isWasmVersion(v: number | null): v is 1.0 | 2.0 | 3.0 {
  return v === 1.0 || v === 2.0 || v === 3.0;
}

export interface NormalizeReport {
  records: InstructionRecord[];
  skipped: {
    /** Opcode slots upstream marks as reserved (version 0.0, name null). */
    reserved: number;
    /**
     * Structural delimiters like `else` and `end` — listed in the
     * appendix for opcode-coverage reasons but with no validation or
     * execution prose, since they're not standalone instructions.
     */
    structural: { name: string; opcode: string | null }[];
    missing_macro: { name: string; opcode: string | null }[];
    missing_category: { name: string; opcode: string | null }[];
    incomplete: { name: string | null; opcode: string | null; reason: string }[];
  };
}

/**
 * Normalise a raw dump into clean instruction records. Reserved /
 * inactive opcodes (version 0.0 with `name: null`) are skipped and
 * reported. Any instruction whose macro / category can't be
 * resolved is also skipped and reported so the build can surface
 * upstream changes the parser doesn't yet handle.
 */
export function normalizeInstructions(dump: RawDump): NormalizeReport {
  const records: InstructionRecord[] = [];
  const report: NormalizeReport["skipped"] = {
    reserved: 0,
    structural: [],
    missing_macro: [],
    missing_category: [],
    incomplete: [],
  };

  for (const raw of dump.instructions) {
    if (raw.name === null || raw.version === 0.0) {
      report.reserved += 1;
      continue;
    }
    // Structural markers (`else`, `end`) have a name + version but
    // no validation / execution prose because they aren't
    // standalone instructions — they delimit blocks. Bucket them
    // separately so the count is informational, not a parser
    // failure.
    if (raw.type === null && raw.validation === null && raw.execution === null) {
      report.structural.push({ name: raw.name, opcode: raw.opcode });
      continue;
    }
    if (!isWasmVersion(raw.version) || !raw.opcode || !raw.type || !raw.validation || !raw.execution) {
      report.incomplete.push({
        name: raw.name,
        opcode: raw.opcode,
        reason: "missing required field (opcode/type/validation/execution/version)",
      });
      continue;
    }

    const mnemonic = resolveMnemonic(raw.name, dump.macros);
    if (mnemonic === null) {
      report.missing_macro.push({ name: raw.name, opcode: raw.opcode });
      continue;
    }
    const category = resolveCategory(raw.name, dump.macros);
    if (category === null) {
      report.missing_category.push({ name: raw.name, opcode: raw.opcode });
      continue;
    }

    const opcodes = parseOpcode(raw.opcode);
    if (opcodes.length === 0) {
      report.incomplete.push({ name: raw.name, opcode: raw.opcode, reason: "no \\hex bytes parsed" });
      continue;
    }

    // raw.version comes in as a JS number (1.0 / 2.0 / 3.0).
    // String(1.0) drops the trailing `.0`, so use toFixed(1) to get
    // the canonical `"1.0"`/`"2.0"`/`"3.0"` form.
    const version = raw.version.toFixed(1) as WasmVersion;

    records.push({
      mnemonic,
      opcodes,
      category,
      version,
      signature: parseSignature(raw.type),
      anchors: { validation: raw.validation, execution: raw.execution },
      urls: {
        validation: instructionUrl(raw.validation),
        execution: instructionUrl(raw.execution),
      },
    });
  }

  return { records, skipped: report };
}
