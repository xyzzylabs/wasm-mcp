// Parse the WebAssembly/proposals repository's Markdown tables into a
// structured proposal index.
//
// Proposals live in three Markdown files:
//   README.md              — active proposals, grouped under
//                            `### Phase N - ...` headings (phases 0–5).
//   finished-proposals.md  — finished (merged) proposals, with extra
//                            columns for affected specs + spec version.
//   inactive-proposals.md  — inactive proposals.
//
// Each table row names a proposal via a reference-style link
// (`[Name][ref]` or `[Name](url)`); the `[ref]: url` definitions sit
// at the bottom of each file. We resolve those to absolute URLs.

export const PROPOSAL_STATUSES = [
  "phase-0",
  "phase-1",
  "phase-2",
  "phase-3",
  "phase-4",
  "phase-5",
  "finished",
  "inactive",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface Proposal {
  /** Proposal display name, e.g. `Threads`, `Garbage collection`. */
  name: string;
  /** Lifecycle status / phase. */
  status: ProposalStatus;
  /** Numeric phase 0–5 for active/finished proposals; null otherwise. */
  phase: number | null;
  /** Champion(s) as written, e.g. `Andreas Rossberg`. */
  champion: string;
  /** Resolved proposal URL (repo / design doc), or null if unlinked. */
  url: string | null;
  /** For finished proposals: affected specs, e.g. `["core", "js-api"]`. */
  affected_specs: string[];
  /** For finished proposals: spec version it landed in, e.g. `3.0`. */
  spec_version: string | null;
}

/** Collect `[ref]: url` reference-link definitions (case-insensitive keys). */
function collectLinkDefs(markdown: string): Map<string, string> {
  const defs = new Map<string, string>();
  for (const line of markdown.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]:\s*(\S+)/);
    if (m) defs.set(m[1]!.toLowerCase(), m[2]!);
  }
  return defs;
}

/** Split a Markdown table row into trimmed cell strings. */
function splitRow(row: string): string[] {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  return /^\s*\|/.test(line) && line.includes("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+$/.test(line) && line.includes("-");
}

/**
 * Resolve a proposal name cell (`[Name][ref]`, `[Name](url)`, or
 * plain text) to { name, url }.
 */
function parseNameCell(cell: string, linkDefs: Map<string, string>): { name: string; url: string | null } {
  // [Name][ref]
  let m = cell.match(/^\[([^\]]+)\]\[([^\]]*)\]/);
  if (m) {
    const name = m[1]!.trim();
    const ref = (m[2]!.trim() || name).toLowerCase();
    return { name, url: linkDefs.get(ref) ?? null };
  }
  // [Name](url)
  m = cell.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  if (m) return { name: m[1]!.trim(), url: m[2]!.trim() };
  // [Name] (shortcut reference)
  m = cell.match(/^\[([^\]]+)\]/);
  if (m) {
    const name = m[1]!.trim();
    return { name, url: linkDefs.get(name.toLowerCase()) ?? null };
  }
  return { name: cell.trim(), url: null };
}

const PHASE_HEADING = /^#{2,4}\s+Phase\s+(\d+)\b/i;

/** Parse README.md (active proposals across phase headings). */
export function parseActiveProposals(markdown: string): Proposal[] {
  const linkDefs = collectLinkDefs(markdown);
  const out: Proposal[] = [];
  let currentPhase: number | null = null;

  const lines = markdown.split("\n");
  for (const line of lines) {
    const heading = line.match(PHASE_HEADING);
    if (heading) {
      currentPhase = parseInt(heading[1]!, 10);
      continue;
    }
    if (currentPhase === null) continue;
    if (!isTableRow(line) || isSeparatorRow(line)) continue;

    const cells = splitRow(line);
    if (cells.length < 2) continue;
    // Skip header rows ("Proposal | Champion").
    if (/^proposals?$/i.test(cells[0]!)) continue;

    const { name, url } = parseNameCell(cells[0]!, linkDefs);
    if (!name) continue;

    out.push({
      name,
      status: `phase-${currentPhase}` as ProposalStatus,
      phase: currentPhase,
      champion: cells[1]!,
      url,
      affected_specs: [],
      spec_version: null,
    });
  }
  return out;
}

/** Parse finished-proposals.md (extra affected-specs + version columns). */
export function parseFinishedProposals(markdown: string): Proposal[] {
  const linkDefs = collectLinkDefs(markdown);
  const out: Proposal[] = [];

  for (const line of markdown.split("\n")) {
    if (!isTableRow(line) || isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    if (/^proposals?$/i.test(cells[0]!)) continue;

    const { name, url } = parseNameCell(cells[0]!, linkDefs);
    if (!name) continue;

    // Columns: Proposal | Champion | Meeting notes | Affected specs | Spec Version
    const affectedRaw = cells[3] ?? "";
    const affected_specs = affectedRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^[a-z-]+$/.test(s));
    const spec_version = (cells[4] ?? "").trim() || null;

    out.push({
      name,
      status: "finished",
      phase: 4,
      champion: cells[1]!,
      url,
      affected_specs,
      spec_version,
    });
  }
  return out;
}

/** Parse inactive-proposals.md. */
export function parseInactiveProposals(markdown: string): Proposal[] {
  const linkDefs = collectLinkDefs(markdown);
  const out: Proposal[] = [];

  for (const line of markdown.split("\n")) {
    if (!isTableRow(line) || isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    if (/^proposals?$/i.test(cells[0]!)) continue;

    const { name, url } = parseNameCell(cells[0]!, linkDefs);
    if (!name) continue;

    out.push({
      name,
      status: "inactive",
      phase: null,
      champion: cells[1]!,
      url,
      affected_specs: [],
      spec_version: null,
    });
  }
  return out;
}

/** Parse all three files into one deduplicated, sorted list. */
export function parseAllProposals(files: {
  readme: string;
  finished: string;
  inactive: string;
}): Proposal[] {
  const all = [
    ...parseActiveProposals(files.readme),
    ...parseFinishedProposals(files.finished),
    ...parseInactiveProposals(files.inactive),
  ];
  // Dedupe by name, preferring the more-advanced status (finished >
  // higher phase > inactive). A proposal should only appear once.
  const rank = (p: Proposal): number =>
    p.status === "finished" ? 100 : p.phase !== null ? p.phase : -1;
  const byName = new Map<string, Proposal>();
  for (const p of all) {
    const existing = byName.get(p.name);
    if (!existing || rank(p) > rank(existing)) byName.set(p.name, p);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
