// Pure query logic for the section index, shared by the stdio server
// and (later) the Cloudflare Worker. Dependency-free — callers pass
// in the already-loaded clauses.

import type { SpecClause } from "../parser/sections.js";

/** Lightweight section row for list / search results. */
export interface SectionSummary {
  id: string;
  anchors: string[];
  title: string | null;
  level: number;
  path: string;
  url: string;
}

export function toSectionSummary(c: SpecClause): SectionSummary {
  return { id: c.id, anchors: c.anchors, title: c.title, level: c.level, path: c.path, url: c.url };
}

/**
 * Fetch one clause by id or by any of its anchors (exact,
 * case-sensitive — anchors are stable lowercase fragment ids).
 */
export function getClause(clauses: SpecClause[], idOrAnchor: string): SpecClause | null {
  const needle = idOrAnchor.trim();
  return (
    clauses.find((c) => c.id === needle || c.anchors.includes(needle)) ??
    // Fall back to case-insensitive match for convenience.
    clauses.find(
      (c) =>
        c.id.toLowerCase() === needle.toLowerCase() ||
        c.anchors.some((a) => a.toLowerCase() === needle.toLowerCase()),
    ) ??
    null
  );
}

export interface SectionListFilter {
  /** Source-path prefix, e.g. `exec`, `binary`, `syntax/types`. */
  path?: string;
  /** Only clauses whose primary anchor / id starts with this prefix. */
  anchor_prefix?: string;
  /** Only clauses with a heading (drop anchor-only content blocks). */
  titled_only?: boolean;
  /** Cap heading depth (1 = page titles only). */
  max_level?: number;
}

/** Enumerate sections, optionally filtered. Preserves source order. */
export function listSections(clauses: SpecClause[], filter: SectionListFilter = {}): SectionSummary[] {
  let out = clauses;
  if (filter.path !== undefined) {
    const p = filter.path;
    out = out.filter((c) => c.path === p || c.path.startsWith(p + "/"));
  }
  if (filter.anchor_prefix !== undefined) {
    const p = filter.anchor_prefix.toLowerCase();
    out = out.filter(
      (c) => c.id.toLowerCase().startsWith(p) || c.anchors.some((a) => a.toLowerCase().startsWith(p)),
    );
  }
  if (filter.titled_only) out = out.filter((c) => c.title !== null);
  if (filter.max_level !== undefined) {
    const max = filter.max_level;
    // level 0 = anchor-only blocks; keep them unless titled_only set.
    out = out.filter((c) => c.level === 0 || c.level <= max);
  }
  return out.map(toSectionSummary);
}

export interface SpecSearchHit extends SectionSummary {
  /** Which field produced the strongest match. */
  matched_on: "anchor-exact" | "title" | "anchor" | "prose";
  /** Relevance score (0–100). Higher = stronger. */
  score: number;
  /** A short prose snippet around the first match, when matched in prose. */
  snippet?: string;
}

function snippetAround(prose: string, needle: string, radius = 80): string {
  const idx = prose.toLowerCase().indexOf(needle);
  if (idx < 0) return prose.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(prose.length, idx + needle.length + radius);
  return (start > 0 ? "…" : "") + prose.slice(start, end).trim() + (end < prose.length ? "…" : "");
}

/**
 * Full-text-ish search over the section index. Ranking (high → low):
 *   exact anchor/id match > title substring > anchor substring >
 *   prose substring. Returns lightweight hits; follow up with
 *   section_get for the full clause.
 */
export function searchSpec(clauses: SpecClause[], query: string, limit = 20): SpecSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];

  const hits: SpecSearchHit[] = [];
  for (const c of clauses) {
    const idLower = c.id.toLowerCase();
    const anchorsLower = c.anchors.map((a) => a.toLowerCase());
    const titleLower = (c.title ?? "").toLowerCase();
    const proseLower = c.prose.toLowerCase();

    let matched_on: SpecSearchHit["matched_on"] | null = null;
    let score = 0;
    let snippet: string | undefined;

    if (idLower === q || anchorsLower.includes(q)) {
      matched_on = "anchor-exact";
      score = 100;
    } else if (titleLower.includes(q)) {
      matched_on = "title";
      score = 80 - titleLower.indexOf(q);
    } else if (anchorsLower.some((a) => a.includes(q)) || idLower.includes(q)) {
      matched_on = "anchor";
      score = 55;
    } else if (proseLower.includes(q)) {
      matched_on = "prose";
      score = 40 - Math.min(20, Math.floor(proseLower.indexOf(q) / 50));
      snippet = snippetAround(c.prose, q);
    }

    if (matched_on) {
      hits.push({ ...toSectionSummary(c), matched_on, score, ...(snippet ? { snippet } : {}) });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return hits.slice(0, limit);
}
