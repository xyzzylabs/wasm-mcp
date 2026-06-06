// Read the pinned upstream SHAs from `vendor/PINNED.txt`. Used by
// build-time scripts and by the runtime `spec_version` tool (the
// build pipeline copies the parsed pin into each baked JSON
// artifact, so the runtime never reads `vendor/` directly).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VENDOR_ROOT } from "../paths.js";

export interface SpecPin {
  /** Repo key, e.g. `spec/main`. */
  readonly key: string;
  /** Full upstream commit SHA. */
  readonly sha: string;
}

/**
 * Parse vendor/PINNED.txt. Throws if the file is missing or empty.
 * Pure read; no network, no fetch.
 */
export function readPins(file = resolve(VENDOR_ROOT, "PINNED.txt")): SpecPin[] {
  const text = readFileSync(file, "utf8");
  const pins: SpecPin[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const sha = line.slice(eq + 1).trim();
    if (key && sha) pins.push({ key, sha });
  }
  if (pins.length === 0) {
    throw new Error(`No pins found in ${file}`);
  }
  return pins;
}

/** Look up a single pin by key. */
export function getPin(key: string, pins = readPins()): SpecPin {
  const found = pins.find((p) => p.key === key);
  if (!found) {
    throw new Error(`Pin not found: ${key} (have: ${pins.map((p) => p.key).join(", ")})`);
  }
  return found;
}
