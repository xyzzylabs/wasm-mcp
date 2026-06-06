# Tool reference

This page is generated from the server's tool definitions
([`src/mcp/tool_meta.ts`](https://github.com/xyzzylabs/wasm-mcp/blob/main/src/mcp/tool_meta.ts))
— the same source the running server registers, so it never drifts.

All 9 tools are **read-only** (`readOnlyHint: true`),
deterministic over the pinned spec commit, and perform no execution
or network I/O.

## spec_version

Return self-description of this MCP server: package name + version, plus the pinned upstream commit SHA for every spec snapshot baked into the package. Use this first when citing the spec, or to verify the server's freshness and reproducibility.

**Title:** Pinned spec version

_No parameters._

## instruction_get

Fetch one WebAssembly instruction by mnemonic (`i32.add`, `br_if`) or binary opcode (`0x6a`, `0xfd 0x89 0x02`) as structured JSON: opcode bytes, category, introducing version, stack type signature, and validation/execution prose anchors + spec URLs. Provide `mnemonic` or `opcode` (mnemonic wins if both match).

**Title:** Get instruction

| Field | Type | Required | Description |
|---|---|---|---|
| `mnemonic` | string | no | Instruction mnemonic, e.g. `i32.add`, `br_if`, `local.get`. Case-insensitive. Exact match. |
| `opcode` | string | no | Binary opcode as hex bytes, e.g. `0x6a`, `6a`, or multi-byte `0xfd 0x89 0x02`. Exact match. Used when `mnemonic` is absent or doesn't match. |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- Get the i32.add instruction
  ```json
  {"mnemonic":"i32.add"}
  ```
  Returns opcode 0x6a, the [i32 i32] → [i32] signature, and validation/execution anchors.
- What instruction is opcode 0x0d?
  ```json
  {"opcode":"0x0d"}
  ```
  Reverse lookup by binary opcode — resolves to br_if.

## instruction_list

Enumerate WebAssembly instructions with optional filters: `category` (control, numeric, parametric, variable, table, memory, ref, i31, struct, array, extern, vec), `introduced_in` (1.0 | 2.0 | 3.0), and `prefix` (mnemonic prefix like `i32.`). Returns lightweight rows sorted by opcode; follow up with instruction_get for full detail.

**Title:** List instructions

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | `control` \| `numeric` \| `parametric` \| `variable` \| `table` \| `memory` \| `ref` \| `i31` \| `struct` \| `array` \| `extern` \| `vec` | no | Filter by instruction category: control, numeric, parametric, variable, table, memory, ref, i31, struct, array, extern, vec (vector/SIMD). |
| `introduced_in` | `1.0` \| `2.0` \| `3.0` | no | Filter to instructions introduced in this WebAssembly version: `1.0`, `2.0`, or `3.0`. |
| `prefix` | string | no | Filter to mnemonics starting with this prefix, e.g. `i32.` or `v128.`. Case-insensitive. |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- List all control-flow instructions
  ```json
  {"category":"control"}
  ```
  Filters to the control category; rows are sorted by opcode.
- What memory instructions did Wasm 3.0 add?
  ```json
  {"category":"memory","introduced_in":"3.0"}
  ```
  Combine category + introduced_in to see what a release contributed.
- List the i32 numeric instructions
  ```json
  {"prefix":"i32."}
  ```
  Prefix filter is the quickest way to scope to one type family.

## instruction_search

Search WebAssembly instructions by free-text query, matched against mnemonic (exact > substring), category name, and opcode hex. The entry point when you don't know the exact mnemonic. Returns ranked lightweight hits with a `matched_on` field; follow up with instruction_get.

**Title:** Search instructions

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Search text. Matched against mnemonic (exact > substring), category name, and opcode hex. E.g. `extend`, `trunc`, `vec`, `0x6a`. |
| `limit` | number | no | Max ranked hits returned. _(default: `20`)_ |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- Find all the extend instructions
  ```json
  {"query":"extend"}
  ```
  Substring match across mnemonics surfaces i32.extend8_s, i64.extend_i32_u, etc.
- Which instruction has opcode 0x6a?
  ```json
  {"query":"0x6a"}
  ```
  A hex query also matches by opcode — resolves i32.add at the top.

## type_get

Look up a WebAssembly type or type form by name: concrete value types (`i32`, `i64`, `f32`, `f64`, `v128`, `funcref`, `externref`, …) or type forms (`functype`, `limits`, `memtype`, `tabletype`, `globaltype`, `reftype`, `valtype`, `rectype`, `heaptype`, …). Returns its classification, sibling members for category types, defining clause prose, SpecTec formal-rule references, and the rendered spec URL.

**Title:** Get type

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Type or type-form name. Concrete value types: `i32`, `i64`, `f32`, `f64`, `v128`, `funcref`, `externref`, … Type forms: `functype`, `limits`, `memtype`, `tabletype`, `globaltype`, `reftype`, `valtype`, `rectype`, `heaptype`, … Case-insensitive, exact match. |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- What is the i32 type?
  ```json
  {"name":"i32"}
  ```
  Returns kind=number, the sibling number types (i64/f32/f64), and the Number Types clause prose + URL.
- Describe a function type
  ```json
  {"name":"functype"}
  ```
  Type forms like functype/limits/memtype resolve to their defining clause in the types section.

## section_get

Fetch one spec clause by id or anchor (e.g. `syntax-numtype`, `valid-unreachable`, `exec-nop`, `binary-instr`, `text-instr`) — matching the rendered spec's stable fragment ids. Returns the clause title, cleaned prose, `:ref:` cross-references, the SpecTec `formal_refs` it cites, and the rendered URL. Validation/execution clauses are SpecTec-generated: prose may be terse, but formal_refs + url point to the formal rule.

**Title:** Get spec section

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Clause id or anchor, e.g. `syntax-numtype`, `valid-unreachable`, `exec-nop`, `binary-instr`, `text-instr`. These match the stable fragment ids in the rendered spec. |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- Get the number types section
  ```json
  {"id":"syntax-numtype"}
  ```
  Returns the Number Types clause: prose, the i32/i64/f32/f64 formal refs, and the spec URL.
- Read the validation rule anchor for unreachable
  ```json
  {"id":"valid-unreachable"}
  ```
  Validation/execution clauses are SpecTec-spliced; prose may be terse but `formal_refs` names the rule and `url` links the rendered notation.

## section_list

Enumerate spec clauses for navigation, filterable by source `path` (`intro`, `syntax`, `valid`, `exec`, `binary`, `text`, `appendix`, or sub-paths like `syntax/types`), `anchor_prefix` (`syntax-`, `valid-`, …), `titled_only`, and `max_level`. Returns lightweight rows {id, anchors, title, level, path, url}; follow up with section_get.

**Title:** List spec sections

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | no | Filter to a source path / prefix. Top-level areas: `intro`, `syntax` (structure), `valid` (validation), `exec` (execution), `binary`, `text`, `appendix`. Sub-paths like `syntax/types` also work. |
| `anchor_prefix` | string | no | Filter to clauses whose id/anchor starts with this prefix, e.g. `syntax-`, `valid-`, `exec-`. |
| `titled_only` | boolean | no | Drop anchor-only content blocks (keep only clauses with a heading). _(default: `false`)_ |
| `max_level` | number | no | Cap heading depth (1 = page titles only). Anchor-only blocks are unaffected. |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- Outline the binary format sections
  ```json
  {"path":"binary","titled_only":true}
  ```
  Path filter scopes to one area; titled_only yields a clean outline.
- List every validation clause
  ```json
  {"anchor_prefix":"valid-"}
  ```
  Anchor-prefix filter gathers all clauses in one rule family.

## spec_search

Full-text search across the spec section index — clause anchors/ids, titles, and prose. The entry point when you don't know the exact anchor. Returns ranked hits with a `matched_on` field (anchor-exact > title > anchor > prose) and a prose snippet for body matches; follow up with section_get.

**Title:** Search spec

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes | Search text. Matched against clause anchors/ids, titles, and prose. E.g. `block type`, `trap`, `funcref`, `little endian`. |
| `limit` | number | no | Max ranked hits returned. _(default: `20`)_ |
| `version` | `main` \| `latest` | no | WebAssembly spec version to query. `latest` (default) is the current served version; `main` is the upstream working draft. _(default: `latest`)_ |

**Examples**

- Where does the spec define traps?
  ```json
  {"query":"trap"}
  ```
  Ranks title matches above prose matches; prose hits include a snippet around the match.
- Find the block type section
  ```json
  {"query":"block type"}
  ```
  Title substring search surfaces syntax-blocktype near the top.

## proposal_list

List WebAssembly proposals and their phases from the pinned WebAssembly/proposals repository. Filter by `status` (phase-0…phase-5, finished, inactive), `phase` (0–5), `champion` substring, `affects` (finished proposals touching core / js-api / web-api), or `contains` (name/champion substring). Each row carries name, status, phase, champion, affected_specs, spec_version, and the proposal URL.

**Title:** List WebAssembly proposals

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `phase-0` \| `phase-1` \| `phase-2` \| `phase-3` \| `phase-4` \| `phase-5` \| `finished` \| `inactive` | no | Filter by lifecycle status: `phase-0`…`phase-5`, `finished` (merged into the spec), or `inactive`. |
| `phase` | number | no | Filter by numeric phase 0–5 (active + finished proposals carry a phase). |
| `champion` | string | no | Champion substring, case-insensitive. |
| `affects` | string | no | Filter to finished proposals affecting a given spec: `core`, `js-api`, or `web-api`. |
| `contains` | string | no | Name or champion substring, case-insensitive. |

**Examples**

- What proposals are finished and in Wasm 3.0?
  ```json
  {"status":"finished","affects":"core"}
  ```
  Finished proposals carry affected_specs + spec_version; filter by the spec they touched.
- What's in phase 3?
  ```json
  {"phase":3}
  ```
  Phase filter scopes to one stage of the proposal process.

