// MCP tool: proposal_list — list WebAssembly proposals and their
// phases from the pinned WebAssembly/proposals repository. Filterable
// by status / phase / champion / affected spec / free-text.

import { z } from "zod";
import { loadProposals } from "../../spec/spec_data.js";
import { listProposals } from "../../spec/proposals_query.js";
import { PROPOSAL_STATUSES, type Proposal } from "../../parser/proposals.js";

export const proposalListSchema = {
  status: z
    .enum(PROPOSAL_STATUSES)
    .optional()
    .describe(
      "Filter by lifecycle status: `phase-0`…`phase-5`, `finished` (merged into the spec), or `inactive`.",
    ),
  phase: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe("Filter by numeric phase 0–5 (active + finished proposals carry a phase)."),
  champion: z.string().min(1).optional().describe("Champion substring, case-insensitive."),
  affects: z
    .string()
    .min(1)
    .optional()
    .describe("Filter to finished proposals affecting a given spec: `core`, `js-api`, or `web-api`."),
  contains: z.string().min(1).optional().describe("Name or champion substring, case-insensitive."),
};

export type ProposalListArgs = {
  status?: (typeof PROPOSAL_STATUSES)[number];
  phase?: number;
  champion?: string;
  affects?: string;
  contains?: string;
};

export const proposalListExamples = [
  {
    q: "What proposals are finished and in Wasm 3.0?",
    input: { status: "finished", affects: "core" },
    note: "Finished proposals carry affected_specs + spec_version; filter by the spec they touched.",
  },
  {
    q: "What's in phase 3?",
    input: { phase: 3 },
    note: "Phase filter scopes to one stage of the proposal process.",
  },
];

export interface ProposalListResult {
  /** Pinned WebAssembly/proposals commit the list was indexed from. */
  pin: { sha: string };
  count: number;
  proposals: Proposal[];
}

export function proposalList(args: ProposalListArgs): ProposalListResult {
  const { pin, proposals } = loadProposals();
  const filtered = listProposals(proposals, args);
  return { pin: { sha: pin.sha }, count: filtered.length, proposals: filtered };
}
