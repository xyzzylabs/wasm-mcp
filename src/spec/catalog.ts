// Spec catalog — what (spec, version) pairs the server claims to
// support, and what build artifact each one corresponds to. Kept
// dependency-free so the Cloudflare Worker can bundle it.

import type { SpecVersion } from "../versions.js";

// The WebAssembly/spec repo carries three specifications under
// /document/. `core` is the first-class target (instructions, types,
// validation, execution, formats); `js-api` and `web-api` are the
// JavaScript + Web embedding specs, covered by the section/search
// tools.
export const SPEC_NAMES = ["core", "js-api", "web-api"] as const;
export type SpecName = (typeof SPEC_NAMES)[number];

/** Specs that have a section index (all of them). */
export const SECTION_SPECS = SPEC_NAMES;

/** Filename (within build/) for the unified core snapshot. */
export function buildArtifactName(spec: "core", version: SpecVersion): string {
  return `wasm-spec-${spec}-${version}.json`;
}

/** Filename (within build/) for an auxiliary spec's section index
 *  (js-api / web-api). */
export function sectionsArtifactName(spec: SpecName, version: SpecVersion): string {
  return `wasm-sections-${spec}-${version}.json`;
}
