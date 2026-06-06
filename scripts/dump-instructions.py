#!/usr/bin/env python3
# Dump the upstream WebAssembly/spec instruction index — plus the
# LaTeX-macro → wasm-mnemonic table — as JSON.
#
# Two upstream files are read:
#
#   document/core/appendix/index-instructions.py
#     Structured source for the appendix instruction table. Defines a
#     single top-level `INSTRUCTIONS` list whose entries are
#     `Instruction(version, name, opcode, type, validation, execution,
#     operator=...)` calls. We parse it via Python's `ast` module so
#     no upstream code ever runs.
#
#   document/core/util/macros.def
#     reStructuredText `|MACRO| mathdef:: \xref{...}{syntax-instr-CAT}
#     {\K{mnemonic}}` lines. The `\K{...}` body is the human-readable
#     mnemonic and the `syntax-instr-CAT` anchor gives the
#     category (control, numeric, vec, memory, ...).
#
# Output is a single JSON object: `{ instructions: [...], macros: {...} }`.
# The TypeScript normaliser in `src/parser/instructions.ts` joins the
# two to produce clean `InstructionRecord`s.

import ast
import json
import os
import re
import sys


INSTRUCTION_KEYS = [
    "version",
    "name",
    "opcode",
    "type",
    "validation",
    "execution",
    "operator",
    "validation2",
    "execution2",
]


def parse_instructions(snapshot_dir: str) -> list[dict]:
    src_path = os.path.join(
        snapshot_dir, "document", "core", "appendix", "index-instructions.py"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        source = f.read()

    tree = ast.parse(source, filename=src_path)

    instructions_list = None
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "INSTRUCTIONS":
                    instructions_list = node.value
                    break
        if instructions_list is not None:
            break

    if instructions_list is None:
        raise SystemExit(f"INSTRUCTIONS list not found in {src_path}")
    if not isinstance(instructions_list, ast.List):
        raise SystemExit(f"INSTRUCTIONS in {src_path} is not a list literal")

    out: list[dict] = []
    for entry in instructions_list.elts:
        if not isinstance(entry, ast.Call):
            raise SystemExit(f"Unexpected non-call entry in INSTRUCTIONS: {ast.dump(entry)}")
        func = entry.func
        if not (isinstance(func, ast.Name) and func.id == "Instruction"):
            raise SystemExit(f"Unexpected entry function: {ast.dump(func)}")

        positional = [ast.literal_eval(a) for a in entry.args]
        kwargs = {kw.arg: ast.literal_eval(kw.value) for kw in entry.keywords}
        record: dict = {k: None for k in INSTRUCTION_KEYS}
        for i, value in enumerate(positional):
            record[INSTRUCTION_KEYS[i]] = value
        for k, value in kwargs.items():
            record[k] = value
        out.append(record)
    return out


# Match every mathdef macro in `util/macros.def` whose body has the
# form  `\xref{SECTION}{ANCHOR}{\K{BODY}}`. Groups:
#   1 = macro name (e.g. `UNREACHABLE`, `I32`, `ADD`)
#   2 = section path (e.g. `syntax/instructions`, `syntax/types`)
#   3 = anchor (e.g. `syntax-instr-control`, `syntax-numtype`)
#   4 = rendered body — the mnemonic / type string, possibly with
#       LaTeX layout escapes (`\K{i\scriptstyle32}`, `\K{local{.}get}`,
#       `\K{br\_if}`). Normalised below.
_MACRO_RE = re.compile(
    r"^\.\.\s+\|([A-Z0-9]+)\|\s+mathdef::\s+"
    r"\\xref\{([^}]+)\}\{([^}]+)\}"
    r"\{\\K\{((?:[^{}]+|\{[^{}]*\})+)\}\}\s*$"
)


def _clean_body(body: str) -> str:
    # `\_` → `_`         (escaped underscore inside identifiers)
    # `{.}` → `.`        (literal dot wrapped to avoid LaTeX
    #                    re-spacing in math mode)
    # `\scriptstyle` → '' (layout-only command — the surrounding
    #                    digits become subscript-sized but read the
    #                    same on the page)
    cleaned = body.replace(r"\_", "_").replace("{.}", ".")
    cleaned = re.sub(r"\\scriptstyle\s*", "", cleaned)
    cleaned = re.sub(r"\\;", "", cleaned)
    # `{digits}` → `digits`. Used to keep number tokens unspaced in
    # LaTeX math mode (e.g. `f{64}x2`).
    cleaned = re.sub(r"\{(\d+)\}", r"\1", cleaned)
    return cleaned


def parse_macros(snapshot_dir: str) -> dict[str, dict]:
    src_path = os.path.join(
        snapshot_dir, "document", "core", "util", "macros.def"
    )
    with open(src_path, "r", encoding="utf-8") as f:
        text = f.read()

    macros: dict[str, dict] = {}
    for line in text.splitlines():
        m = _MACRO_RE.match(line)
        if not m:
            continue
        macro, section, anchor, body_raw = m.group(1), m.group(2), m.group(3), m.group(4)
        body = _clean_body(body_raw)

        kind = "other"
        category: str | None = None
        if anchor.startswith("syntax-instr-"):
            kind = "instruction"
            category = anchor[len("syntax-instr-"):]
        elif anchor in (
            "syntax-numtype",
            "syntax-vectype",
            "syntax-reftype",
            "syntax-valtype",
            "syntax-shape",
        ):
            kind = "type"

        macros[macro] = {
            "body": body,
            "kind": kind,
            "category": category,
            "section": section,
            "anchor": anchor,
        }
    return macros


def dump(snapshot_dir: str) -> None:
    payload = {
        "instructions": parse_instructions(snapshot_dir),
        "macros": parse_macros(snapshot_dir),
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: dump-instructions.py <snapshot-dir>")
    dump(sys.argv[1])
