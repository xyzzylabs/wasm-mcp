// MCP tool: type_get — look up a WebAssembly type or type form by
// name (`i32`, `funcref`, `v128`, `functype`, `limits`, …). Returns
// its classification, sibling members for category types, defining
// clause prose, formal-rule references, and the rendered spec URL.

import { z } from "zod";
import { versionArg } from "../_args.js";
import { loadTypes } from "../../spec/spec_data.js";
import { getType, type TypeEntry } from "../../parser/types.js";
import type { VersionValue } from "../../versions.js";

export const typeGetSchema = {
  name: z
    .string()
    .min(1)
    .describe(
      "Type or type-form name. Concrete value types: `i32`, `i64`, `f32`, `f64`, `v128`, `funcref`, `externref`, … Type forms: `functype`, `limits`, `memtype`, `tabletype`, `globaltype`, `reftype`, `valtype`, `rectype`, `heaptype`, … Case-insensitive, exact match.",
    ),
  version: versionArg,
};

export type TypeGetArgs = { name: string; version?: VersionValue };

export const typeGetExamples = [
  {
    q: "What is the i32 type?",
    input: { name: "i32" },
    note: "Returns kind=number, the sibling number types (i64/f32/f64), and the Number Types clause prose + URL.",
  },
  {
    q: "Describe a function type",
    input: { name: "functype" },
    note: "Type forms like functype/limits/memtype resolve to their defining clause in the types section.",
  },
];

export function typeGet(args: TypeGetArgs): TypeEntry | null {
  const catalog = loadTypes(args.version);
  return getType(catalog, args.name);
}
