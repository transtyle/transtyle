---
title: "CLI reference"
description: "Commands, exit codes, diagnostics format."
order: 7
---

# CLI reference

One binary, subcommands. Human logs go to **stderr**; requested data goes to stdout; exit codes are stable. All variant selection lives in [config](/docs/configuration/), never in flags — same command, same output, on every machine.

## Implemented

### `transtyle build [instance...]`

Runs the full pipeline and writes artifacts. With no arguments, builds every target instance in the config; with names, only those (`transtyle build shadcn shadcn-v3`).

```bash
npx transtyle build shadcn
#
# shadcn  43% native · 54% derived · 3% approximated
#   ↳ dist/shadcn/globals.transtyle.css
#   ↳ dist/shadcn/usage.md
#   ↳ dist/shadcn/report.json
#
# ✔ build complete
```

Per instance, emits the exporter's artifacts plus `report.json` (schema-versioned: coverage items, diagnostics, file list). If any `error`-level diagnostic exists, nothing is emitted — a build never half-succeeds.

### `transtyle check [instance...]`

The pipeline minus EMIT — same code path, guaranteed to agree with real builds. Runs schema validation, alias/cycle detection, mode validation, WCAG contrast checks, and coverage computation, writing nothing.

### `--cwd <dir>`

Run against a project directory from anywhere: `transtyle build --cwd examples/cathode`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (possibly with warnings below your `check.failOn` threshold) |
| 1 | Diagnostics at or above the `failOn` threshold |
| 2 | Usage or config error (unknown command, missing config, broken exporter) |

## Diagnostics format

Every diagnostic has a stable code, printed with severity:

```
⚠ TST2101 text-muted.base vs surface.base is 4.4:1 in light mode (< 4.5:1 wcag21-aa)
✖ TST1104 Alias cycle: semantic.color.a → semantic.color.b → semantic.color.a
```

The full code table lives in [Weird things & diagnostics](/docs/diagnostics/#diagnostic-code-reference).

## Specced, not yet implemented

These exist as design (see [Status & roadmap](/docs/roadmap/)) and will keep the same principles when they land:

| Command | What it will do |
|---|---|
| `transtyle init` | Interactive scaffold: brand color prompt → working project |
| `transtyle add <exporter>` | Install + register exporter packages, printing their manifest first |
| `transtyle explain <token>` | Full provenance chain: authored where, derived by which rule from what, mapped to which target variable |
| `transtyle diff [ref]` | Semantic diff of the resolved token graph vs. a git ref, with per-target impact |
| `transtyle import <source>` | Materialize an importer's output (Figma, Tailwind, Bootstrap) as reviewable token files |
| `transtyle preview` | Local themed preview site across all targets |

Programmatic use: every command wraps `@transtyle/core`'s public `compile()` — the CLI contains no logic a build-tool integration can't reach.
