// Parse the WebAssembly core spec's reStructuredText sources into a
// flat, anchor-addressable clause index.
//
// Since March 2025 the spec is authored in SpecTec: the `.rst` files
// carry hand-written prose interleaved with SpecTec splice macros
// (`$${syntax: numtype}`, `$${rule-prose: Step_pure/nop}`,
// `${:I32}`). The OCaml SpecTec tool expands those into the formal
// grammar / typing / reduction notation at build time. We do NOT run
// SpecTec here — that keeps the build deterministic over the pinned
// SHA without an OCaml toolchain. Instead we:
//
//   - keep the hand-written prose (rich for syntax/binary/text/intro/
//     appendix sections),
//   - record the SpecTec rule / syntax names the splices reference
//     (`formal_refs`) so callers can see which formal rule a clause
//     defines and follow the rendered URL for the notation itself,
//   - resolve every `:ref:` cross-reference target.
//
// Each clause is addressable by any of the `.. _anchor:` labels that
// attach to it, mirroring the stable fragment ids in the rendered
// spec.

export interface SpecClause {
  /** Primary id — first attached anchor, else a slug of the title. */
  id: string;
  /** Every `.. _label:` anchor that addresses this clause. */
  anchors: string[];
  /** Heading text, or null for an anchor-only content block. */
  title: string | null;
  /** Heading depth (1 = page title). 0 for anchor-only blocks. */
  level: number;
  /** Source file relative to `document/core/`, e.g. `syntax/types`. */
  path: string;
  /** Cleaned prose text (SpecTec splices + RST roles stripped). */
  prose: string;
  /** `:ref:` cross-reference targets cited in this clause. */
  crossrefs: string[];
  /** SpecTec rule / syntax names referenced by splice macros. */
  formal_refs: string[];
  /** Full URL into the rendered spec. */
  url: string;
}

const SPEC_BASE = "https://webassembly.github.io/spec/core";

/** Map a source path + anchor to the rendered spec URL. */
export function clauseUrl(path: string, anchor: string | null): string {
  const page = `${SPEC_BASE}/${path}.html`;
  return anchor ? `${page}#${anchor}` : page;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Is `underline` a valid RST heading underline for `title`? */
function isUnderline(underline: string, title: string): boolean {
  if (underline.length < 1) return false;
  const ch = underline[0]!;
  if (!"=-~^\"`+*#:.'_".includes(ch)) return false;
  if (![...underline].every((c) => c === ch)) return false;
  // RST requires the underline to be at least as long as the title.
  return underline.length >= title.trim().length && title.trim().length > 0;
}

/**
 * Strip SpecTec splice macros and RST inline roles from a prose
 * block, collecting cross-reference targets and formal-rule names as
 * a side effect.
 */
function cleanProse(
  raw: string,
  crossrefs: Set<string>,
  formalRefs: Set<string>,
): string {
  let text = raw;

  const collectRefs = (body: string): string[] => {
    // body like "rule-prose: Step_pure/nop", "syntax: numtype",
    // "rule: {Step_pure/select-*}", or ":I32" (inline atom).
    const colon = body.indexOf(":");
    const payload = (colon >= 0 ? body.slice(colon + 1) : body).trim();
    const names: string[] = [];
    for (const ref of payload.split(/[\s,]+/)) {
      const name = ref.replace(/[{}]/g, "").trim();
      if (name && /[A-Za-z]/.test(name)) {
        formalRefs.add(name);
        names.push(name);
      }
    }
    return names;
  };

  // Block-level SpecTec splices `$${...}` — whole formal blocks
  // (grammar, typing/reduction rules). Record the referenced names
  // and drop the block from prose. The brace body may nest one level
  // (`$${rule: {Step_pure/nop}}`).
  text = text.replace(/\$\$\{(?:[^{}]|\{[^{}]*\})*\}/g, (m) => {
    collectRefs(m.slice(3, -1));
    return "";
  });

  // Inline SpecTec atoms `${...}` — a single type / keyword / value
  // reference rendered inline. Record the name and keep it readable
  // (`${:I32}` → `I32`, `${:SELECT}` → `SELECT`).
  text = text.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, (m) => {
    const names = collectRefs(m.slice(2, -1));
    return names.join(" ");
  });

  // :ref:`text <target>` and :ref:`target` → keep text, record target.
  text = text.replace(/:ref:`([^`<]+?)\s*<([^>]+)>`/g, (_m, label: string, target: string) => {
    crossrefs.add(target.trim());
    return label.trim();
  });
  text = text.replace(/:ref:`([^`]+)`/g, (_m, target: string) => {
    crossrefs.add(target.trim());
    return target.trim();
  });

  // Other RST roles: :math:`x`, :code:`x`, :token:`x`, :superscript:`x`
  // → keep the inner content.
  text = text.replace(/:[a-z]+:`([^`]*)`/g, "$1");

  // Substitution refs: |IEEE754|_ or |foo| → strip the bars.
  text = text.replace(/\|([A-Za-z0-9_]+)\|_?/g, "$1");

  // Emphasis markers (keep the words).
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/``([^`]+)``/g, "$1");

  // Collapse whitespace.
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

interface RawBlock {
  anchors: string[];
  title: string | null;
  level: number;
  bodyLines: string[];
}

/**
 * Parse one RST document into clauses. `path` is the source-relative
 * path without extension (e.g. `syntax/types`).
 */
export function parseRst(source: string, path: string): SpecClause[] {
  const lines = source.split("\n");

  // First pass: discover the order in which underline chars appear so
  // we can assign heading levels the RST way (first char seen = level 1).
  const charLevels = new Map<string, number>();
  for (let i = 0; i + 1 < lines.length; i++) {
    const title = lines[i]!;
    const underline = lines[i + 1]!;
    if (title.trim() !== "" && isUnderline(underline.trim(), title)) {
      const ch = underline.trim()[0]!;
      if (!charLevels.has(ch)) charLevels.set(ch, charLevels.size + 1);
    }
  }

  const blocks: RawBlock[] = [];
  let pendingAnchors: string[] = [];
  let current: RawBlock | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Anchor label: `.. _name:`
    const anchorMatch = trimmed.match(/^\.\.\s+_([A-Za-z0-9_.-]+):$/);
    if (anchorMatch) {
      pendingAnchors.push(anchorMatch[1]!);
      continue;
    }

    // Heading: a non-blank line followed by an underline.
    const next = lines[i + 1];
    if (trimmed !== "" && next !== undefined && isUnderline(next.trim(), line)) {
      flush();
      current = {
        anchors: pendingAnchors,
        title: trimmed,
        level: charLevels.get(next.trim()[0]!) ?? 1,
        bodyLines: [],
      };
      pendingAnchors = [];
      i++; // consume the underline line
      continue;
    }

    // Other `.. directive::` lines (index, note, etc.). An anchor's
    // content can be a bare splice/paragraph, so anchors that were
    // pending and are now hitting non-heading content start an
    // anchor-only block.
    if (pendingAnchors.length > 0 && trimmed !== "") {
      flush();
      current = { anchors: pendingAnchors, title: null, level: 0, bodyLines: [] };
      pendingAnchors = [];
    }

    if (current) current.bodyLines.push(line);
  }
  flush();

  // Drop pure `.. index::` / directive noise from body and build clauses.
  const clauses: SpecClause[] = [];
  for (const block of blocks) {
    const crossrefs = new Set<string>();
    const formalRefs = new Set<string>();

    // Remove standalone directive blocks we don't surface as prose:
    // `.. index::` (+ its indented continuation lines) and the
    // `.. toctree::` / `.. only::` machinery. Keep `.. note::` /
    // `.. warning::` bodies as prose.
    const kept: string[] = [];
    let skippingDirective = false;
    for (const raw of block.bodyLines) {
      const directive = raw.match(/^\.\.\s+([a-z-]+)::/);
      if (directive) {
        const name = directive[1]!;
        skippingDirective = ["index", "toctree", "only", "math"].includes(name);
        if (skippingDirective) continue;
        // Admonitions: drop the directive marker, keep following text.
        continue;
      }
      // Indented continuation of a skipped directive.
      if (skippingDirective) {
        if (raw.trim() === "" || /^\s/.test(raw)) continue;
        skippingDirective = false;
      }
      kept.push(raw);
    }

    const prose = cleanProse(kept.join("\n"), crossrefs, formalRefs);
    const anchors = block.anchors;
    const id = anchors[0] ?? (block.title ? `${path}-${slugify(block.title)}` : path);

    // Skip empty connective blocks (no anchor, no title, no prose).
    if (anchors.length === 0 && block.title === null && prose === "") continue;

    clauses.push({
      id,
      anchors,
      title: block.title,
      level: block.level,
      path,
      prose,
      crossrefs: [...crossrefs],
      formal_refs: [...formalRefs],
      url: clauseUrl(path, anchors[0] ?? null),
    });
  }

  return clauses;
}
