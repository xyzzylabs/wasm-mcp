// `spec_version` — return the pinned upstream commits + package
// version. Reads the pin from the baked artifacts (which ship in the
// package), NOT from vendor/PINNED.txt (which is a build-time-only
// input and is absent from the published package). The simplest
// read-only tool; serves as a freshness probe and a smoke test that
// the data pipeline ran.

import { z } from "zod";
import { loadSnapshot, loadProposals } from "../../spec/spec_data.js";

export const specVersionSchema = {} as const;

export interface SpecVersionPin {
  /** Pin key, e.g. `spec/main` or `proposals/main`. */
  key: string;
  /** Full upstream commit SHA pinned for this snapshot. */
  sha: string;
}

export interface SpecVersionResult {
  /** Package name as published to npm. */
  name: string;
  /** Package version read from package.json at runtime. */
  version: string;
  /** Pins baked into the package (core spec + proposals). */
  pins: SpecVersionPin[];
}

const PinSchema = z.object({ key: z.string(), sha: z.string() });
export const SpecVersionResultSchema = z.object({
  name: z.string(),
  version: z.string(),
  pins: z.array(PinSchema),
});

export function specVersion(packageInfo: { name: string; version: string }): SpecVersionResult {
  const pins: SpecVersionPin[] = [];

  const spec = loadSnapshot();
  pins.push({ key: spec.pin.key, sha: spec.pin.sha });

  // Proposals are a separate, optional artifact (separate upstream
  // repo + pin). Tolerate its absence so the core tool still works.
  try {
    const proposals = loadProposals();
    pins.push({ key: proposals.pin.key, sha: proposals.pin.sha });
  } catch {
    // proposals index not built — omit it from the pin list.
  }

  return { name: packageInfo.name, version: packageInfo.version, pins };
}
