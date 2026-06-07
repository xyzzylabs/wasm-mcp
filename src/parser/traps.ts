// Per-instruction trap conditions.
//
// WebAssembly's trapping behaviour is a finite, well-defined property
// of a small set of instruction families. This module encodes that
// set as a pure mnemonic → conditions mapping, applied at build time
// to the pinned instruction list. No execution, no scraping — the
// rules express the spec's operator partiality (which operators are
// partial, and on what input) and the trapping instruction families
// (memory/table accesses, indirect calls, null dereferences).
//
// Trap NAMES are the spec's canonical strings, verified against the
// pinned spec's own conformance suite (`test/core/*.wast`
// `assert_trap` messages): `integer divide by zero`, `integer
// overflow`, `invalid conversion to integer`, `out of bounds memory
// access`, `out of bounds table access`, `undefined element`,
// `uninitialized element`, `indirect call type mismatch`,
// `unreachable`, `null reference`.
//
// Scope note: array accessors and `ref.cast` also trap, but with
// conditions whose canonical names are NOT present in the pinned core
// test suite (e.g. out-of-bounds array access, cast failure). Rather
// than ship partial or unverified trap data, they are intentionally
// omitted here; structs (no out-of-bounds, null-deref only) and the
// single-condition reference instructions are modelled in full.

/** One way an instruction can trap. */
export interface TrapCondition {
  /** Terse description of the runtime condition that triggers the trap. */
  condition: string;
  /** The spec's canonical trap name (matches `.wast` `assert_trap` text). */
  name: string;
}

// Canonical conditions, named once so the mapping reads cleanly.
const DIVIDE_BY_ZERO: TrapCondition = { condition: "divisor is zero", name: "integer divide by zero" };
const DIV_OVERFLOW: TrapCondition = {
  condition: "signed overflow (INT_MIN / -1)",
  name: "integer overflow",
};
const TRUNC_INVALID: TrapCondition = {
  condition: "operand is NaN or an infinity",
  name: "invalid conversion to integer",
};
const TRUNC_OVERFLOW: TrapCondition = {
  condition: "truncated value is outside the target integer range",
  name: "integer overflow",
};
const MEM_OOB: TrapCondition = {
  condition: "effective address + access size is outside the memory bounds",
  name: "out of bounds memory access",
};
const MEM_RANGE_OOB: TrapCondition = {
  condition: "source or destination range is outside the memory bounds",
  name: "out of bounds memory access",
};
const TABLE_OOB: TrapCondition = {
  condition: "index is outside the table bounds",
  name: "out of bounds table access",
};
const TABLE_RANGE_OOB: TrapCondition = {
  condition: "source or destination range is outside the table bounds",
  name: "out of bounds table access",
};
const CALL_INDIRECT_UNDEF: TrapCondition = {
  condition: "table index is outside the table bounds",
  name: "undefined element",
};
const CALL_INDIRECT_UNINIT: TrapCondition = {
  condition: "table element is a null reference",
  name: "uninitialized element",
};
const CALL_INDIRECT_TYPE: TrapCondition = {
  condition: "runtime function type does not match the expected type",
  name: "indirect call type mismatch",
};
const nullRef = (condition: string): TrapCondition => ({ condition, name: "null reference" });

/**
 * Derive the trap conditions for an instruction mnemonic. Returns an
 * empty array for instructions that cannot trap. Pure and total.
 */
export function deriveTraps(mnemonic: string): TrapCondition[] {
  const m = mnemonic;

  // `unreachable` always traps.
  if (m === "unreachable") {
    return [{ condition: "always — executing this instruction unconditionally traps", name: "unreachable" }];
  }

  // Integer division / remainder (partial operators).
  if (/^i(32|64)\.div_s$/.test(m)) return [DIVIDE_BY_ZERO, DIV_OVERFLOW];
  if (/^i(32|64)\.div_u$/.test(m)) return [DIVIDE_BY_ZERO];
  // rem_s does NOT overflow (INT_MIN % -1 is defined as 0).
  if (/^i(32|64)\.rem_[su]$/.test(m)) return [DIVIDE_BY_ZERO];

  // Non-saturating float→int truncation. `trunc_sat_*` saturate and
  // never trap, so the `_sat_` form deliberately fails this pattern.
  if (/^i(32|64)\.trunc_f(32|64)_[su]$/.test(m)) return [TRUNC_INVALID, TRUNC_OVERFLOW];

  // Memory accesses: every load / store variant, including SIMD
  // lane/splat loads (`v128.load32_zero`, `v128.store8_lane`, …).
  if (/\.(load|store)/.test(m)) return [MEM_OOB];
  if (/^memory\.(init|copy|fill)$/.test(m)) return [MEM_RANGE_OOB];

  // Table accesses.
  if (/^table\.(get|set)$/.test(m)) return [TABLE_OOB];
  if (/^table\.(init|copy|fill)$/.test(m)) return [TABLE_RANGE_OOB];

  // Indirect call: out-of-bounds index, null element, type mismatch.
  if (m === "call_indirect") return [CALL_INDIRECT_UNDEF, CALL_INDIRECT_UNINIT, CALL_INDIRECT_TYPE];

  // Reference instructions with a single null-dereference trap.
  if (m === "ref.as_non_null") return [nullRef("operand is a null reference")];
  if (m === "call_ref") return [nullRef("the function reference operand is null")];
  if (/^struct\.(get|get_s|get_u|set)$/.test(m)) return [nullRef("the struct reference operand is null")];

  return [];
}
