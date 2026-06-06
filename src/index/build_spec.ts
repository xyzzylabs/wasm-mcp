// Build-time orchestrator: assemble the unified baked artifact for
// each pinned snapshot from three sources, all derived from the
// vendored WebAssembly/spec checkout:
//
//   instructions  ← build/instructions-raw-<branch>.json
//                   (dumped by scripts/dump-instructions.py, then
//                    normalised by src/parser/instructions.ts)
//   sections      ← every document/core/**/*.rst parsed by
//                    src/parser/sections.ts
//   types         ← the macro table + syntax/types clauses, joined by
//                    src/parser/types.ts
//
// Output: build/wasm-spec-core-<branch>.json. The runtime server
// reads this file; it never re-runs the pipeline.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { BUILD_DIR, VENDOR_ROOT } from "../paths.js";
import { readPins } from "../spec/pin.js";
import { buildArtifactName } from "../spec/catalog.js";
import {
  normalizeInstructions,
  type RawDump,
  type InstructionRecord,
} from "../parser/instructions.js";
import { parseRst, type SpecClause } from "../parser/sections.js";
import { buildTypeCatalog, type TypeEntry } from "../parser/types.js";

export interface BakedSnapshot {
  pin: { key: string; sha: string; spec: "core"; version: string };
  instructions: InstructionRecord[];
  sections: SpecClause[];
  types: TypeEntry[];
  report: {
    instructions: number;
    reserved: number;
    structural: number;
    missing_macro: number;
    missing_category: number;
    incomplete: number;
    sections: number;
    types: number;
  };
}

function walkRst(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkRst(p));
    else if (entry.endsWith(".rst")) out.push(p);
  }
  return out;
}

function parseSections(coreDir: string): SpecClause[] {
  const clauses: SpecClause[] = [];
  for (const file of walkRst(coreDir).sort()) {
    const rel = relative(coreDir, file).replace(/\.rst$/, "");
    clauses.push(...parseRst(readFileSync(file, "utf8"), rel));
  }
  return clauses;
}

export function bake(branch: string, pinKey: string): BakedSnapshot {
  const pin = readPins().find((p) => p.key === pinKey);
  if (!pin) throw new Error(`No pin for ${pinKey}`);

  const rawPath = resolve(BUILD_DIR, `instructions-raw-${branch}.json`);
  const dump = JSON.parse(readFileSync(rawPath, "utf8")) as RawDump;
  const { records, skipped } = normalizeInstructions(dump);

  const coreDir = resolve(VENDOR_ROOT, `wasm-spec-${branch}/document/core`);
  const sections = parseSections(coreDir);
  const typeClauses = sections.filter((c) => c.path === "syntax/types");
  const types = buildTypeCatalog(dump.macros, typeClauses);

  return {
    pin: { key: pin.key, sha: pin.sha, spec: "core", version: branch },
    instructions: records,
    sections,
    types,
    report: {
      instructions: records.length,
      reserved: skipped.reserved,
      structural: skipped.structural.length,
      missing_macro: skipped.missing_macro.length,
      missing_category: skipped.missing_category.length,
      incomplete: skipped.incomplete.length,
      sections: sections.length,
      types: types.length,
    },
  };
}

function main() {
  const pins = readPins().filter((p) => p.key.startsWith("spec/"));
  if (pins.length === 0) {
    console.error("error: no spec/* pins found in vendor/PINNED.txt");
    process.exitCode = 1;
    return;
  }

  for (const pin of pins) {
    const branch = pin.key.slice("spec/".length);
    const rawPath = resolve(BUILD_DIR, `instructions-raw-${branch}.json`);
    if (!existsSync(rawPath)) {
      console.error(`error: ${rawPath} missing — run scripts/dump-instructions.py first`);
      process.exitCode = 1;
      return;
    }
    const baked = bake(branch, pin.key);
    const out = resolve(BUILD_DIR, buildArtifactName("core", branch as "main"));
    writeFileSync(out, JSON.stringify(baked) + "\n");
    console.log(
      `✓ ${out}\n` +
        `    instructions=${baked.report.instructions} ` +
        `(reserved=${baked.report.reserved}, structural=${baked.report.structural})\n` +
        `    sections=${baked.report.sections}  types=${baked.report.types}`,
    );
    if (
      baked.report.missing_macro > 0 ||
      baked.report.missing_category > 0 ||
      baked.report.incomplete > 0
    ) {
      console.error(
        `warning: parser dropped instructions — missing_macro=${baked.report.missing_macro}, ` +
          `missing_category=${baked.report.missing_category}, incomplete=${baked.report.incomplete}`,
      );
    }
  }
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/build_spec.ts") || entry.endsWith("/build_spec.js"))) {
  main();
}
