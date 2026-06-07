// Parse the Bikeshed (.bs) sources for the JS-API and Web-API specs
// into the same anchor-addressable `SpecClause` shape the RST parser
// produces, so the section query functions work unchanged across all
// three specs.
//
// Unlike the core spec (reStructuredText + SpecTec), the js-api and
// web-api specs are authored in Bikeshed and use plain HTML headings
// with stable ids — `<h2 id="modules">Modules</h2>` — which map
// directly to the fragment ids in the rendered spec. Bodies mix HTML,
// Web IDL blocks, and Bikeshed autolink shorthands; we strip those to
// readable prose and record the cross-reference targets.

import type { SpecClause } from "./sections.js";

const SPEC_BASE = "https://webassembly.github.io/spec";

/** Map a Bikeshed spec path + anchor to the rendered spec URL. */
export function bikeshedUrl(path: string, anchor: string | null): string {
  const page = `${SPEC_BASE}/${path}/`;
  return anchor ? `${page}#${anchor}` : page;
}

/** Strip inline HTML tags and decode the few entities we encounter. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Clean a Bikeshed body block into readable prose, collecting
 * cross-reference targets as a side effect. Removes fenced/`<pre>`
 * code + IDL blocks, resolves Bikeshed autolink shorthands, and
 * strips remaining HTML.
 */
function cleanBody(raw: string, crossrefs: Set<string>): string {
  let text = raw;

  // Drop fenced code blocks (```...```), <pre>/<xmp> blocks (IDL,
  // algorithms, examples) — they aren't prose.
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/<(pre|xmp)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  // Bikeshed autolinks:
  //   [=term=]            definition autolink
  //   [=term|display=]    definition with custom text
  //   {{IdlThing}}        IDL autolink
  //   [[#anchor]]         local section ref
  //   [[BIBLIO]]          bibliography ref
  text = text.replace(/\[=([^=\]|]+)(?:\|([^=\]]+))?=\]/g, (_m, term: string, disp?: string) => {
    crossrefs.add(term.trim());
    return (disp ?? term).trim();
  });
  text = text.replace(/\{\{([^}]+)\}\}/g, (_m, idl: string) => {
    const name = idl.split("/")[0]!.trim();
    crossrefs.add(name);
    return name;
  });
  text = text.replace(/\[\[#([^\]]+)\]\]/g, (_m, anchor: string) => {
    crossrefs.add(anchor.trim());
    return anchor.trim();
  });
  text = text.replace(/\[\[!?([A-Z0-9-]+)\]\]/g, "$1");

  // Bikeshed algorithm-variable markers: |source| → source.
  text = text.replace(/\|([A-Za-z][A-Za-z0-9 _]*)\|/g, "$1");

  // Markdown emphasis / inline code → plain text.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remaining HTML tags + entities.
  text = stripTags(text);

  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const HEADING_RE = /<h([1-6])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;

/**
 * Parse a Bikeshed document into clauses. `path` is the spec slug
 * (`js-api` or `web-api`).
 */
export function parseBikeshed(source: string, path: string): SpecClause[] {
  // Locate every heading with its byte offset so we can slice the
  // body that follows each one (up to the next heading).
  const heads: { level: number; anchor: string; title: string; start: number; end: number }[] = [];
  for (const m of source.matchAll(HEADING_RE)) {
    heads.push({
      level: Number(m[1]),
      anchor: m[2]!,
      title: stripTags(m[3]!),
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }

  const clauses: SpecClause[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]!;
    const bodyEnd = i + 1 < heads.length ? heads[i + 1]!.start : source.length;
    const crossrefs = new Set<string>();
    const prose = cleanBody(source.slice(h.end, bodyEnd), crossrefs);
    clauses.push({
      id: h.anchor,
      anchors: [h.anchor],
      title: h.title || null,
      level: h.level,
      path,
      prose,
      crossrefs: [...crossrefs],
      formal_refs: [],
      url: bikeshedUrl(path, h.anchor),
    });
  }
  return clauses;
}
