// Shared Zod argument fragments reused across tool input schemas, so
// every tool describes the `version` selector identically.

import { z } from "zod";
import { VERSION_VALUES } from "../versions.js";

/**
 * The spec version selector. `latest` (default) resolves to the
 * current served version; `main` is the working draft. More release
 * labels (e.g. `3.0`) can be added without changing tool code.
 */
export const versionArg = z
  .enum(VERSION_VALUES)
  .default("latest")
  .describe(
    "WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft.",
  );
