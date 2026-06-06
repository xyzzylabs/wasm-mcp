// Runtime loader for the baked instruction artifact. Reads
// `build/wasm-spec-core-<version>.json` (produced at build time by
// src/index/build_instructions.ts) once per version and caches the
// parsed result in-memory. Pure local read — no network, no writes.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { buildArtifactName } from "./catalog.js";
import { resolveVersion, type VersionValue } from "../versions.js";
import type { InstructionRecord } from "../parser/instructions.js";

export interface LoadedSnapshot {
  pin: { key: string; sha: string; spec: "core"; version: string };
  instructions: InstructionRecord[];
  report: Record<string, number>;
}

const cache = new Map<string, LoadedSnapshot>();

/**
 * Load (and cache) the baked snapshot for a given version selector.
 * Throws if the artifact is missing — that means the build pipeline
 * didn't run, which is a packaging error, not a user error.
 */
export function loadSnapshot(version?: VersionValue): LoadedSnapshot {
  const v = resolveVersion(version);
  const cached = cache.get(v);
  if (cached) return cached;

  const file = resolve(BUILD_DIR, buildArtifactName("core", v));
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(
      `Baked instruction artifact not found: ${file}. ` +
        `Run \`npm run fetch-spec && npm run build-spec\` to generate it. (${String(err)})`,
    );
  }
  const snapshot = JSON.parse(raw) as LoadedSnapshot;
  cache.set(v, snapshot);
  return snapshot;
}

/** Convenience: just the instruction records for a version. */
export function loadInstructions(version?: VersionValue): InstructionRecord[] {
  return loadSnapshot(version).instructions;
}

/** Test/Worker seam: inject a snapshot directly, bypassing the file read. */
export function primeCache(version: string, snapshot: LoadedSnapshot): void {
  cache.set(version, snapshot);
}
