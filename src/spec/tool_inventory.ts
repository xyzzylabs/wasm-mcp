// Canonical list of tool names exposed by the server. Used by the
// server-instructions string so the count stays in sync with the
// actual registrations, and (later) by the Worker to filter to the
// hosted-safe subset.

export const HOSTED_TOOLS = [
  "spec_version",
  "instruction_get",
  "instruction_list",
  "instruction_search",
  "type_get",
  "section_get",
  "section_list",
  "spec_search",
] as const;
export type HostedToolName = (typeof HOSTED_TOOLS)[number];

export const STDIO_ONLY_TOOLS = [] as const;
export type StdioOnlyToolName = (typeof STDIO_ONLY_TOOLS)[number];

export const TOTAL_TOOL_COUNT = HOSTED_TOOLS.length + STDIO_ONLY_TOOLS.length;
