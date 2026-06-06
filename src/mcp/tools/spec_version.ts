// `spec_version` — return the pinned upstream commit + when it was
// indexed. The simplest possible read-only tool; serves both as a
// freshness probe for callers and as a smoke test that the data
// pipeline ran.

import { z } from "zod";
import { readPins } from "../../spec/pin.js";

export const specVersionSchema = {} as const;

export interface SpecVersionPin {
  /** Pin key as written in `vendor/PINNED.txt`, e.g. `spec/main`. */
  key: string;
  /** Full upstream commit SHA pinned for this snapshot. */
  sha: string;
}

export interface SpecVersionResult {
  /** Package name as published to npm. */
  name: string;
  /** Package version read from package.json at runtime. */
  version: string;
  /** Every pin currently recorded in `vendor/PINNED.txt`. */
  pins: SpecVersionPin[];
}

const PinSchema = z.object({ key: z.string(), sha: z.string() });
export const SpecVersionResultSchema = z.object({
  name: z.string(),
  version: z.string(),
  pins: z.array(PinSchema),
});

export function specVersion(packageInfo: { name: string; version: string }): SpecVersionResult {
  const pins = readPins().map((p) => ({ key: p.key, sha: p.sha }));
  return { name: packageInfo.name, version: packageInfo.version, pins };
}
