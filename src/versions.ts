// Wasm spec version catalog.
//
// Unlike ECMA-262 (which publishes annual editions), the WebAssembly
// core specification publishes named releases (1.0, 2.0, 3.0). For
// the MVP we serve only the current working draft (`main`) pinned to
// a specific commit; release branches can be added here when needed
// without touching tool code.
//
// Kept dependency-free so the Cloudflare Worker can bundle it.

export const SUPPORTED_VERSIONS = ["main"] as const;
export type SpecVersion = (typeof SUPPORTED_VERSIONS)[number];

export const VERSION_ALIASES = ["latest"] as const;
export type VersionAlias = (typeof VERSION_ALIASES)[number];

export const VERSION_VALUES = [...SUPPORTED_VERSIONS, ...VERSION_ALIASES] as const;
export type VersionValue = (typeof VERSION_VALUES)[number];

/**
 * Resolve a public version selector to the on-disk version key.
 * For now `latest` maps to `main`; once a stable release (e.g. 3.0)
 * is pinned, `latest` shifts to that without callers changing.
 */
export function resolveVersion(v: VersionValue | undefined): SpecVersion {
  if (v === undefined || v === "latest") return "main";
  return v;
}
