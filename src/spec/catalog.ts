// Spec catalog — what (spec, version) pairs the server claims to
// support, and what build artifact each one corresponds to. Kept
// dependency-free so the future Cloudflare Worker can bundle it.

import type { SpecVersion } from "../versions.js";

export const SPEC_NAMES = ["core"] as const;
export type SpecName = (typeof SPEC_NAMES)[number];

/** Filename (within build/) for a given (spec, version) snapshot. */
export function buildArtifactName(spec: SpecName, version: SpecVersion): string {
  return `wasm-spec-${spec}-${version}.json`;
}
