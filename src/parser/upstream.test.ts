import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { VENDOR_ROOT } from "../paths.js";
import { extractRawDump, parseInstructions, parseMacros } from "./upstream.js";

describe("parseInstructions (unit)", () => {
  const src = [
    "INSTRUCTIONS = [",
    "    Instruction(1.0, r'\\UNREACHABLE', r'\\hex{00}', r'[t_1^\\ast] \\to [t_2^\\ast]', r'valid-unreachable', r'exec-unreachable'),",
    "    Instruction(1.0, r'\\ELSE', r'\\hex{05}'),",
    "    Instruction(0.0, None, r'\\hex{06}'),",
    "    Instruction(3.0, r'\\I8X16.\\VRELAXEDLANESELECT', r'\\hex{FD}~~\\hex{89}~~\\hex{02}', r'[\\V128] \\to [\\V128]', r'valid-vternop', r'exec-vternop', r'op-irelaxed_laneselect'),",
    "]",
  ].join("\n");
  const out = parseInstructions(src);

  it("parses positional args into the signature keys", () => {
    expect(out[0]).toMatchObject({
      version: 1,
      name: "\\UNREACHABLE",
      opcode: "\\hex{00}",
      type: "[t_1^\\ast] \\to [t_2^\\ast]",
      validation: "valid-unreachable",
      execution: "exec-unreachable",
      operator: null,
    });
  });

  it("handles short calls and None", () => {
    expect(out[1]).toMatchObject({ name: "\\ELSE", opcode: "\\hex{05}", type: null });
    expect(out[2]).toMatchObject({ version: 0, name: null, opcode: "\\hex{06}" });
  });

  it("captures the trailing operator arg + multi-byte opcode", () => {
    expect(out[3]!.operator).toBe("op-irelaxed_laneselect");
    expect(out[3]!.opcode).toBe("\\hex{FD}~~\\hex{89}~~\\hex{02}");
  });
});

describe("parseMacros (unit)", () => {
  const src = [
    ".. |UNREACHABLE| mathdef:: \\xref{syntax/instructions}{syntax-instr-control}{\\K{unreachable}}",
    ".. |LOCALGET| mathdef:: \\xref{syntax/instructions}{syntax-instr-variable}{\\K{local{.}get}}",
    ".. |I32| mathdef:: \\xref{syntax/types}{syntax-numtype}{\\K{i\\scriptstyle32}}",
    ".. |BRIF| mathdef:: \\xref{syntax/instructions}{syntax-instr-control}{\\K{br\\_if}}",
  ].join("\n");
  const macros = parseMacros(src);

  it("classifies instruction macros + category", () => {
    expect(macros.UNREACHABLE).toMatchObject({ body: "unreachable", kind: "instruction", category: "control" });
  });
  it("cleans {.} and \\_ and \\scriptstyle", () => {
    expect(macros.LOCALGET!.body).toBe("local.get");
    expect(macros.BRIF!.body).toBe("br_if");
    expect(macros.I32).toMatchObject({ body: "i32", kind: "type" });
  });
});

describe("extractRawDump (pinned source)", () => {
  const dump = extractRawDump(resolve(VENDOR_ROOT, "wasm-spec-main"));
  it("matches the known upstream shape", () => {
    expect(dump.instructions.length).toBe(580);
    expect(Object.keys(dump.macros).length).toBeGreaterThan(390);
    expect(dump.macros.I32).toMatchObject({ body: "i32", kind: "type" });
  });
});
