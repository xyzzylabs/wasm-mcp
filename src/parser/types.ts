// Build a type catalog from the macro table (concrete value-type
// names) joined with the parsed `syntax/types` section clauses
// (the prose + anchors that define each type and type form).
//
// Two kinds of entry:
//   - concrete value types — `i32`, `f64`, `v128`, `funcref`, … —
//     grouped under their category section (number / vector /
//     reference types);
//   - type forms — `functype`, `limits`, `memtype`, `rectype`, … —
//     each its own clause in the types section.

import type { SpecClause } from "./sections.js";

export type TypeKind = "number" | "vector" | "reference" | "form";

export interface TypeEntry {
  /** Type or type-form name, e.g. `i32`, `funcref`, `functype`. */
  name: string;
  /** Classification of this entry. */
  kind: TypeKind;
  /** Defining clause anchor, e.g. `syntax-numtype`, `syntax-functype`. */
  anchor: string;
  /** For category types: the sibling concrete types (e.g. the four
   *  number types). Empty for type forms. */
  members: string[];
  /** Defining clause title, e.g. `Number Types`. */
  title: string | null;
  /** Defining clause prose. */
  prose: string;
  /** SpecTec rule / syntax names referenced by the defining clause. */
  formal_refs: string[];
  /** Rendered spec URL for the defining clause. */
  url: string;
}

/** Raw macro shape as emitted by scripts/dump-instructions.py. */
interface RawMacro {
  body: string;
  kind: "instruction" | "type" | "other";
  category: string | null;
  section: string;
  anchor: string;
}

// Concrete value-type macros are tagged with these anchors. Each maps
// to a catalog `kind`, the canonical category clause anchor, and an
// `accept` predicate that keeps only well-formed concrete type names.
//
// The macro table also defines meta-variable shorthands under these
// same anchors (`\INX` → `i`, `\FNX` → `f`, `\VNX` → `v`), lane
// widths (`\I128` → `i128`), and reference constructors / keywords
// (`\REF` → `ref`, `\NULL` → `null`). Those aren't value types, so
// `accept` filters them out.
const VALUE_TYPE_ANCHORS: Record<
  string,
  { kind: TypeKind; clause: string; accept: (body: string) => boolean }
> = {
  "syntax-numtype": {
    kind: "number",
    clause: "syntax-numtype",
    accept: (b) => /^[if](32|64)$/.test(b),
  },
  "syntax-vectype": {
    kind: "vector",
    clause: "syntax-vectype",
    accept: (b) => b === "v128",
  },
  "syntax-reftype": {
    kind: "reference",
    clause: "syntax-reftype",
    accept: (b) => b.endsWith("ref") && b !== "ref",
  },
};

function findClause(clauses: SpecClause[], anchor: string): SpecClause | undefined {
  return clauses.find((c) => c.anchors.includes(anchor));
}

/**
 * Build the type catalog. `macros` is the dumped macro table;
 * `typeClauses` is the parsed `syntax/types` section.
 */
export function buildTypeCatalog(
  macros: Record<string, RawMacro>,
  typeClauses: SpecClause[],
): TypeEntry[] {
  const entries: TypeEntry[] = [];
  const seen = new Set<string>();

  // 1. Concrete value types, grouped by category anchor.
  const byCategory = new Map<string, string[]>();
  for (const macro of Object.values(macros)) {
    if (macro.kind !== "type") continue;
    const mapping = VALUE_TYPE_ANCHORS[macro.anchor];
    if (!mapping) continue; // skip syntax-shape / syntax-valtype aliases here
    if (!mapping.accept(macro.body)) continue; // drop meta-vars / keywords
    const list = byCategory.get(mapping.clause) ?? [];
    if (!list.includes(macro.body)) list.push(macro.body);
    byCategory.set(mapping.clause, list);
  }

  for (const [clauseAnchor, mapping] of Object.entries(VALUE_TYPE_ANCHORS)) {
    const members = (byCategory.get(clauseAnchor) ?? []).sort();
    const clause = findClause(typeClauses, mapping.clause);
    for (const name of members) {
      if (seen.has(name)) continue;
      seen.add(name);
      entries.push({
        name,
        kind: mapping.kind,
        anchor: clauseAnchor,
        members: members.filter((m) => m !== name),
        title: clause?.title ?? null,
        prose: clause?.prose ?? "",
        formal_refs: clause?.formal_refs ?? [],
        url:
          clause?.url ??
          `https://webassembly.github.io/spec/core/syntax/types.html#${clauseAnchor}`,
      });
    }
  }

  // 2. Type forms — every `syntax-<form>` clause in the types section
  //    that isn't already a concrete value type. Covers functype,
  //    limits, memtype, tabletype, globaltype, rectype, heaptype,
  //    resulttype, blocktype, externtype, etc.
  for (const clause of typeClauses) {
    for (const anchor of clause.anchors) {
      const m = anchor.match(/^syntax-([a-z0-9]+)$/);
      if (!m) continue;
      const name = m[1]!;
      if (seen.has(name)) continue;
      // Skip the category clauses already represented by their members.
      if (anchor in VALUE_TYPE_ANCHORS) continue;
      seen.add(name);
      entries.push({
        name,
        kind: "form",
        anchor,
        members: [],
        title: clause.title,
        prose: clause.prose,
        formal_refs: clause.formal_refs,
        url: clause.url,
      });
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** Look up one type by name (case-insensitive, exact). */
export function getType(catalog: TypeEntry[], name: string): TypeEntry | null {
  const needle = name.trim().toLowerCase();
  return catalog.find((t) => t.name.toLowerCase() === needle) ?? null;
}
