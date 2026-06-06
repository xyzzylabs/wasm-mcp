// Runtime loader for the unified baked artifact. Reads
// `build/wasm-spec-core-<version>.json` (produced at build time by
// src/index/build_spec.ts) once per version and caches the parsed
// result in-memory. Pure local read — no network, no writes.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILD_DIR } from "../paths.js";
import { buildArtifactName } from "./catalog.js";
import { resolveVersion, type VersionValue } from "../versions.js";
import type { InstructionRecord } from "../parser/instructions.js";
import type { SpecClause } from "../parser/sections.js";
import type { TypeEntry } from "../parser/types.js";
import type { Proposal } from "../parser/proposals.js";

export interface LoadedSnapshot {
  pin: { key: string; sha: string; spec: "core"; version: string };
  instructions: InstructionRecord[];
  sections: SpecClause[];
  types: TypeEntry[];
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
      `Baked spec artifact not found: ${file}. ` +
        `Run \`npm run fetch-spec && npm run build-spec\` to generate it. (${String(err)})`,
    );
  }
  const snapshot = JSON.parse(raw) as LoadedSnapshot;
  cache.set(v, snapshot);
  return snapshot;
}

/** Convenience accessors for a version. */
export function loadInstructions(version?: VersionValue): InstructionRecord[] {
  return loadSnapshot(version).instructions;
}
export function loadSections(version?: VersionValue): SpecClause[] {
  return loadSnapshot(version).sections;
}
export function loadTypes(version?: VersionValue): TypeEntry[] {
  return loadSnapshot(version).types;
}

/** Test/Worker seam: inject a snapshot directly, bypassing the file read. */
export function primeCache(version: string, snapshot: LoadedSnapshot): void {
  cache.set(version, snapshot);
}

// ─── Proposals ─────────────────────────────────────────────────────
// Proposals come from a separate upstream repo (WebAssembly/proposals)
// with its own pin, so they're a separate baked artifact loaded
// independently of the core spec snapshot.

export interface LoadedProposals {
  pin: { key: string; sha: string; repo: "proposals"; version: string };
  proposals: Proposal[];
}

const proposalsCache = new Map<string, LoadedProposals>();

export function loadProposals(version = "main"): LoadedProposals {
  const cached = proposalsCache.get(version);
  if (cached) return cached;
  const file = resolve(BUILD_DIR, `wasm-proposals-${version}.json`);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(
      `Baked proposals artifact not found: ${file}. ` +
        `Run \`npm run fetch-spec && npm run build-spec\` to generate it. (${String(err)})`,
    );
  }
  const loaded = JSON.parse(raw) as LoadedProposals;
  proposalsCache.set(version, loaded);
  return loaded;
}

export function primeProposalsCache(version: string, loaded: LoadedProposals): void {
  proposalsCache.set(version, loaded);
}
