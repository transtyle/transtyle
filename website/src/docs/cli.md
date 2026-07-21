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

### `transtyle explain <slot> [--mode <name>]`

Prints a slot's resolved value, provenance, and — for derived/defaulted values — the rule that computed it and every input, recursively indented. Accepts the slot with or without the `semantic.`/`semantic.color.` prefix.

```bash
npx transtyle explain primary.on-tint
#
# semantic.color.primary.on-tint = oklch(0.48 0.162 255)  [#005bb6]
#  └─ derived by rule contrast-pick(subtle)@standard@1
#     inputs: semantic.color.primary.tint = oklch(0.95 0.017 255)  [#e7effa]
#      └─ derived by rule mix-toward-surface(0.92)@standard@1
#         inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
#          └─ aliased → option.color.blue.600
```

An unknown slot exits 2 and lists the 5 closest catalog names instead of a bare error.

### `transtyle init [name]`

Scaffolds `transtyle.config.json` + `tokens/brand.tokens.json` (a minimal example: one brand color, elevation levels 0–1, text, border, radius, fonts — each with a `$description: "TODO: ..."` placeholder) and a `css-variables` target so the first build works immediately. Refuses (exit 2) if a config already exists.

### `transtyle add <target>`

Validates the target against the CLI's known exporters and inserts `"<target>": { "output": "dist/<target>" }` into the existing config. Refuses (exit 2) for an unknown or already-configured target.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (possibly with warnings below your `check.failOn` threshold) |
| 1 | Diagnostics at or above the `failOn` threshold |
| 2 | Usage or config error (unknown command, missing config, broken exporter) |

## Diagnostics format

Every diagnostic has a stable code, printed with severity:

```
⚠ TST2101 text.muted vs elevation.1.surface is 4.4:1 in light mode (< 4.5:1 wcag21-aa)
✖ TST1104 Alias cycle: semantic.color.a → semantic.color.b → semantic.color.a
```

The full code table lives in [Weird things & diagnostics](/docs/diagnostics/#diagnostic-code-reference).

## Specced, not yet implemented

These exist as design (see [Status & roadmap](/docs/roadmap/)) and will keep the same principles when they land:

| Command | What it will do |
|---|---|
| `transtyle init` (interactive mode) | A brand-color prompt instead of the fixed placeholder scaffold shipped today |
| `transtyle add <exporter>` (community plugins) | Install + register third-party exporter packages, printing their manifest first |
| `transtyle explain <token> --target <t>` | Also show which target variable the value maps to and why (today's `explain` stops at provenance) |
| `transtyle diff [ref]` | Semantic diff of the resolved token graph vs. a git ref, with per-target impact |
| `transtyle import <source>` | Materialize an importer's output (Figma, Tailwind, Bootstrap) as reviewable token files |
| `transtyle preview` | Local themed preview site across all targets |

Programmatic use: every command wraps `@transtyle/core`'s public `compile()` — the CLI contains no logic a build-tool integration can't reach.
