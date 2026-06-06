// Build-time orchestrator: take a snapshot's raw-instruction JSON
// (produced by `scripts/dump-instructions.py`) and the corresponding
// pin entry from `vendor/PINNED.txt`, run the normaliser, and write
// the baked artifact to `build/wasm-spec-core-<branch>.json`.
//
// Run via `npm run build-spec` (after `npm run fetch-spec`). This
// script is the only place that ever writes to `build/`; the runtime
// MCP server reads those files but never produces them.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { readPins } from "../spec/pin.js";
import { buildArtifactName } from "../spec/catalog.js";
import { normalizeInstructions, type RawDump, type InstructionRecord } from "../parser/instructions.js";

export interface BakedSnapshot {
  pin: {
    /** Repo key, e.g. `spec/main`. */
    key: string;
    /** Full upstream commit SHA. */
    sha: string;
    /** Spec name within the WebAssembly/spec repo. */
    spec: "core";
    /** Version label inside that spec (`main`, `3.0`, …). */
    version: string;
  };
  /** Every active, normalised instruction at this pin. */
  instructions: InstructionRecord[];
  /** Counts only — kept tiny so the baked file stays compact. */
  report: {
    reserved: number;
    structural: number;
    missing_macro: number;
    missing_category: number;
    incomplete: number;
  };
}

export function bake(rawPath: string, pinKey: string): BakedSnapshot {
  const pin = readPins().find((p) => p.key === pinKey);
  if (!pin) throw new Error(`No pin for ${pinKey}`);
  const dump = JSON.parse(readFileSync(rawPath, "utf8")) as RawDump;
  const { records, skipped } = normalizeInstructions(dump);
  return {
    pin: { key: pin.key, sha: pin.sha, spec: "core", version: pin.key.split("/")[1] ?? "main" },
    instructions: records,
    report: {
      reserved: skipped.reserved,
      structural: skipped.structural.length,
      missing_macro: skipped.missing_macro.length,
      missing_category: skipped.missing_category.length,
      incomplete: skipped.incomplete.length,
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
    const baked = bake(rawPath, pin.key);
    const out = resolve(BUILD_DIR, buildArtifactName("core", branch as "main"));
    writeFileSync(out, JSON.stringify(baked, null, 2) + "\n");
    console.log(
      `✓ ${out}  (${baked.instructions.length} instructions; ` +
        `reserved=${baked.report.reserved}, structural=${baked.report.structural}, ` +
        `incomplete=${baked.report.incomplete})`,
    );
    if (baked.report.missing_macro > 0 || baked.report.missing_category > 0 || baked.report.incomplete > 0) {
      console.error(
        `warning: parser dropped entries — missing_macro=${baked.report.missing_macro}, ` +
          `missing_category=${baked.report.missing_category}, ` +
          `incomplete=${baked.report.incomplete}`,
      );
    }
  }
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/build_instructions.ts") || entry.endsWith("/build_instructions.js"))) {
  main();
}
