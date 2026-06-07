// Build section-index artifacts for the auxiliary specs (js-api,
// web-api) from their Bikeshed sources in the vendored
// WebAssembly/spec checkout. They share the core spec's pin (same
// repo + SHA) but are separate documents, so each gets its own
// artifact: build/wasm-sections-<spec>-<branch>.json.
//
// The core spec's sections live in the unified core artifact (see
// build_spec.ts); only js-api + web-api are produced here.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR, VENDOR_ROOT } from "../paths.js";
import { readPins } from "../spec/pin.js";
import { sectionsArtifactName, type SpecName } from "../spec/catalog.js";
import { parseBikeshed } from "../parser/bikeshed.js";
import type { SpecClause } from "../parser/sections.js";

const AUX_SPECS: Exclude<SpecName, "core">[] = ["js-api", "web-api"];

export interface BakedSections {
  pin: { key: string; sha: string; spec: SpecName; version: string };
  sections: SpecClause[];
}

export function bake(spec: Exclude<SpecName, "core">, branch: string, pinKey: string): BakedSections {
  const pin = readPins().find((p) => p.key === pinKey);
  if (!pin) throw new Error(`No pin for ${pinKey}`);
  const bsPath = resolve(VENDOR_ROOT, `wasm-spec-${branch}/document/${spec}/index.bs`);
  const sections = parseBikeshed(readFileSync(bsPath, "utf8"), spec);
  return { pin: { key: pin.key, sha: pin.sha, spec, version: branch }, sections };
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
    for (const spec of AUX_SPECS) {
      const bsPath = resolve(VENDOR_ROOT, `wasm-spec-${branch}/document/${spec}/index.bs`);
      if (!existsSync(bsPath)) {
        console.error(`error: ${bsPath} missing — run \`npm run fetch-spec\` first`);
        process.exitCode = 1;
        return;
      }
      const baked = bake(spec, branch, pin.key);
      const out = resolve(BUILD_DIR, sectionsArtifactName(spec, branch as "main"));
      writeFileSync(out, JSON.stringify(baked) + "\n");
      console.log(`✓ ${out}  (${baked.sections.length} ${spec} sections)`);
    }
  }
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/build_aux_specs.ts") || entry.endsWith("/build_aux_specs.js"))) {
  main();
}
