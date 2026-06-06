// Resolved at module load. Used by build-time scripts and the runtime
// server to locate the baked `build/` artifacts relative to the
// repository root (in dev) or the published package (in dist).

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// In dev:  src/paths.ts          → repo-root is `../`.
// In dist: dist/paths.js         → repo-root is `../`.
// Either way one `..` lands us at the project root.
export const REPO_ROOT = resolve(HERE, "..");

export const BUILD_DIR = resolve(REPO_ROOT, "build");
export const VENDOR_ROOT = resolve(REPO_ROOT, "vendor");
