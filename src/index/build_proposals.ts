// Build-time builder for the proposals index. Reads the three
// Markdown files from the vendored WebAssembly/proposals checkout and
// writes build/wasm-proposals-<branch>.json. The runtime server reads
// that file; it never re-runs the parse.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR, VENDOR_ROOT } from "../paths.js";
import { readPins } from "../spec/pin.js";
import { parseAllProposals, type Proposal } from "../parser/proposals.js";

export interface BakedProposals {
  pin: { key: string; sha: string; repo: "proposals"; version: string };
  proposals: Proposal[];
}

export function bake(branch: string, pinKey: string): BakedProposals {
  const pin = readPins().find((p) => p.key === pinKey);
  if (!pin) throw new Error(`No pin for ${pinKey}`);
  const dir = resolve(VENDOR_ROOT, `wasm-proposals-${branch}`);
  const read = (name: string) => readFileSync(resolve(dir, name), "utf8");
  const proposals = parseAllProposals({
    readme: read("README.md"),
    finished: read("finished-proposals.md"),
    inactive: read("inactive-proposals.md"),
  });
  return {
    pin: { key: pin.key, sha: pin.sha, repo: "proposals", version: branch },
    proposals,
  };
}

function main() {
  const pins = readPins().filter((p) => p.key.startsWith("proposals/"));
  if (pins.length === 0) {
    console.error("error: no proposals/* pins found in vendor/PINNED.txt");
    process.exitCode = 1;
    return;
  }
  for (const pin of pins) {
    const branch = pin.key.slice("proposals/".length);
    const dir = resolve(VENDOR_ROOT, `wasm-proposals-${branch}`);
    if (!existsSync(dir)) {
      console.error(`error: ${dir} missing — run \`npm run fetch-spec\` first`);
      process.exitCode = 1;
      return;
    }
    const baked = bake(branch, pin.key);
    const out = resolve(BUILD_DIR, `wasm-proposals-${branch}.json`);
    writeFileSync(out, JSON.stringify(baked) + "\n");
    const byStatus = baked.proposals.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`✓ ${out}  (${baked.proposals.length} proposals: ${JSON.stringify(byStatus)})`);
  }
}

const entry = process.argv[1];
if (entry && (entry.endsWith("/build_proposals.ts") || entry.endsWith("/build_proposals.js"))) {
  main();
}
