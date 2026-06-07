// Shared Zod argument fragments reused across tool input schemas, so
// every tool describes the `version` selector identically.

import { z } from "zod";
import { VERSION_VALUES } from "../versions.js";
import { SPEC_NAMES } from "../spec/catalog.js";

/**
 * Which WebAssembly specification to query. `core` (default) is the
 * instruction set / validation / execution / formats; `js-api` and
 * `web-api` are the JavaScript + Web embedding specs. Only the
 * section/search tools are spec-aware — instruction and type tools are
 * `core`-only.
 */
export const specArg = z
  .enum(SPEC_NAMES)
  .default("core")
  .describe(
    "Which WebAssembly spec to query: `core` (default; instructions, types, validation, execution, formats), `js-api` (JavaScript embedding), or `web-api` (Web platform integration).",
  );

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
