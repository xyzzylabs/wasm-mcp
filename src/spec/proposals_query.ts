// Pure query logic for the proposals index. Dependency-free; callers
// pass in the already-loaded proposal list.

import type { Proposal, ProposalStatus } from "../parser/proposals.js";

export interface ProposalFilter {
  /** Filter by lifecycle status (`phase-3`, `finished`, `inactive`, …). */
  status?: ProposalStatus;
  /** Filter by numeric phase 0–5. */
  phase?: number;
  /** Champion substring, case-insensitive. */
  champion?: string;
  /** Affected-spec filter (`core`, `js-api`, `web-api`) — finished only. */
  affects?: string;
  /** Name / champion substring, case-insensitive. */
  contains?: string;
}

/** Filter + sort the proposal list. Sorted by phase desc, then name. */
export function listProposals(proposals: Proposal[], filter: ProposalFilter = {}): Proposal[] {
  let out = proposals;
  if (filter.status !== undefined) out = out.filter((p) => p.status === filter.status);
  if (filter.phase !== undefined) out = out.filter((p) => p.phase === filter.phase);
  if (filter.champion !== undefined) {
    const c = filter.champion.toLowerCase();
    out = out.filter((p) => p.champion.toLowerCase().includes(c));
  }
  if (filter.affects !== undefined) {
    const a = filter.affects.toLowerCase();
    out = out.filter((p) => p.affected_specs.some((s) => s.toLowerCase() === a));
  }
  if (filter.contains !== undefined) {
    const q = filter.contains.toLowerCase();
    out = out.filter(
      (p) => p.name.toLowerCase().includes(q) || p.champion.toLowerCase().includes(q),
    );
  }
  return [...out].sort((a, b) => (b.phase ?? -1) - (a.phase ?? -1) || a.name.localeCompare(b.name));
}
