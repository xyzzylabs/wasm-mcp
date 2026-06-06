// Pure refresh-decision logic, kept separate from I/O so it can be
// unit-tested. Given the currently-pinned SHAs and the SHAs upstream
// reports right now, decide whether the baked data is stale.
//
// wasm-mcp bakes its data into the npm tarball *and* the Worker
// bundle, so any upstream move warrants a new PATCH release: re-bake,
// bump the patch version, tag, publish, deploy.

export interface PinMove {
  key: string;
  from: string;
  to: string;
}

export interface RefreshDecision {
  /** Pins whose upstream SHA differs from what we have baked. */
  moved: PinMove[];
  /** True when at least one pin moved. */
  needsRefresh: boolean;
}

/**
 * Compare current pins against upstream. Only keys present in BOTH
 * maps are considered (an upstream lookup that failed is omitted by
 * the caller, so we never "move" a pin to an empty/unknown SHA).
 */
export function decideRefresh(
  current: Record<string, string>,
  upstream: Record<string, string>,
): RefreshDecision {
  const moved: PinMove[] = [];
  for (const [key, from] of Object.entries(current)) {
    const to = upstream[key];
    if (to && to !== from) moved.push({ key, from, to });
  }
  return { moved, needsRefresh: moved.length > 0 };
}

/**
 * Bump the patch component of a semver `major.minor.patch` string.
 * Pre-release / build metadata is dropped. Throws on malformed input.
 */
export function bumpPatch(version: string): string {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Not a semver version: ${version}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}
