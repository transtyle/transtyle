---
title: 'CLI reference'
description: 'Commands, exit codes, diagnostics format.'
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
# shadcn  42% native · 53% derived · 3% approximated · 3% dropped
#   ↳ dist/shadcn/globals.transtyle.css
#   ↳ dist/shadcn/usage.md
#   ↳ dist/shadcn/report.json
#
# ✔ build complete
```

Per instance, emits the exporter's artifacts plus `report.json` (schema-versioned: coverage items, the catalog slots the exporter read, diagnostics, file list). If any `error`-level diagnostic exists, nothing is emitted — a build never half-succeeds.

### `--out <dir>`, `--dry-run`

`build` only. `--out <dir>` writes every target to `<dir>/<instance name>` instead of its configured `output`, `report.json` included (a relative `<dir>` is relative to your shell, like `--cwd`). A Storybook target's imports of its sibling stylesheets follow the redirect. `--dry-run` runs the whole build and stops before writing: it prints the coverage and the files it **would** write, `report.json` and sizes included, and leaves the disk untouched. Both compose, and a dry run fails exactly like the real build would (exit 1 on a diagnostic at or above `failOn`), so it works as a CI gate.

```bash
npx transtyle build --dry-run --out /tmp/themes
#
# shadcn  42% native · 53% derived · 3% approximated · 3% dropped
#   ↳ would write ../../tmp/themes/shadcn/globals.transtyle.css
#   ↳ would write ../../tmp/themes/shadcn/report.json
#
# ✔ dry run complete, nothing written
```

### `--quiet`, `--verbose`, `NO_COLOR`

`build` and `check`. `--quiet` prints only what explains a failure: errors, warnings when `check.failOn` is `warning`, and the `✖ failed` line. A successful run prints nothing on stderr, and what you asked for on stdout (`check --json`) is unchanged. `--verbose` adds, per target, the exporter, its options, the output directory, the row counts and each file's size, and prints the stack of a crashed exporter or a fatal error; `TRANSTYLE_DEBUG=1` is the same switch. The two together exit 2. Neither is accepted by the commands whose output is the answer (`explain`, `diff`, `catalog`, `bindings`).

The CLI never colors its output, so `NO_COLOR` changes nothing there; it is honored by contract. The one place color is possible is the chip `init` prints on a terminal, which `NO_COLOR` turns off.

### `transtyle check [instance...]`

The pipeline minus EMIT — same code path, guaranteed to agree with real builds. Runs schema validation, alias/cycle detection, mode validation, WCAG contrast checks, and coverage computation, writing nothing.

### `--json`

`check`, `diff` and `catalog`. For `check`, prints the full diagnostics array, the `suppressed` list and per-target coverage to **stdout** as one JSON object — human-readable logs still go to stderr, so both work in the same invocation (pipe stdout to `jq`, read stderr in your terminal):

```bash
npx transtyle check --json
# { "diagnostics": [ { "severity": "warning", "code": "TST1305", "message": "...",
#                         "path": "scratch", "file": "tokens/brand.tokens.json", "line": 74, "column": 3 }, ... ],
#   "suppressed": [ ... ],
#   "targets": [ { "target": "shadcn", "coverage": [ ... ], "reads": [ ... ] }, ... ] }
```

### `--matrix`

`check` only. Prints, for every catalog slot, which targets read it: the answer to "if I author this slot, which libraries change?". The compiler records each slot an exporter reads while it emits (each target's `reads`, also in its `report.json`), so the table holds for any exporter, third-party ones included, and needs nothing from them. Each reader is classed from its coverage rows: `native`, `derived` or `approximated` when a row names the slot, `input` when the exporter reads it to compute a value described under another slot or a pattern (a Radix ramp, a PrimeNG surface). Slots are grouped by catalog section; the table goes to **stdout**.

```bash
npx transtyle check --matrix
#
# semantic.color.elevation
#   0.surface   12/12  shadcn (native), shadcn-v3 (native), echarts (native), daisyui (native), …
#   1.shadow     4/12  css-variables (native), mantine (native), chakra (approximated), mui (approximated)
#   3.surface    6/12  shadcn (derived), shadcn-v3 (derived), echarts (derived), css-variables (native), primeng (input), mui (approximated)
```

With `--json`, the table is not printed and the JSON report gains a `matrix` key: `{ "targets": [...], "slots": { "<slot>": { "<target>": { "class": "native", "variables": ["--card"] } } } }`, one entry per catalog slot (an empty object when nothing reads it), sorted. From your own code, `consumption(result)` from `@transtyle/core` builds the same object from a `compile()` result. The [slot matrix](/docs/slot-matrix/) page is the same table for Acme and every official exporter, regenerated on every change.

### `--cwd <dir>`

Run against a project directory from anywhere: `transtyle build --cwd examples/cathode`.

### `transtyle explain <slot> [--mode <name>]`

Prints a slot's resolved value, provenance, and — for derived/defaulted values — the rule that computed it and every input, recursively indented. An alias is followed to its target, so the chain always ends at what was authored. Accepts the slot with or without the `semantic.`/`semantic.color.` prefix.

```bash
npx transtyle explain primary.on-tint
#
# semantic.color.primary.on-tint = oklch(0.48 0.162 255)  [#005bb6]
#  └─ derived by rule contrast-pick(subtle)@standard@1
#     inputs: semantic.color.primary.tint = oklch(0.95 0.017 255)  [#e7effa]
#      └─ derived by rule mix-toward-surface(0.92)@standard@1
#         inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
#          └─ aliased → option.color.blue.600
#              └─ authored
#         inputs: semantic.color.elevation.1.surface = oklch(0.985 0.003 255)  [#f9fafc]
#          └─ aliased → option.color.gray.50
#              └─ authored
```

An unknown slot exits 2 and lists the 5 closest catalog names instead of a bare error. `--json` prints the same tree as data (what `explainToken()` returns).

A slot produced by a [`bindings` rule](/docs/configuration/#binding-rules) names it: `└─ aliased → option.color.primary.50  (from rule bindings[2]: semantic.color.{role}.tint)`.

### `transtyle explain --target <t>`, `--variable <name>`

The other direction, for when a rendered page surprises you: "why is `$btn-border-radius` 9999px?". `--target` takes a target instance from your config (`bootstrap`, `shadcn-v3`); the CLI compiles that one target without writing anything, so no build is needed first.

```bash
npx transtyle explain --variable '$form-select-border-radius' --target bootstrap
#
# bootstrap:
#   $form-select-border-radius  derived  via $input-border-radius
#     $input-border-radius  derived  → component.control.radius
#
# component.control.radius = 0.5rem
#  └─ derived by rule alias(radius.control)@standard@1
#     inputs: semantic.radius.control = 0.5rem
#      └─ derived by rule alias(radius.md)@standard@1
#         inputs: semantic.radius.md = 0.5rem
#          └─ authored

npx transtyle explain component.button.radius --target bootstrap
#
# component.button.radius = 9999px
#  └─ aliased → semantic.radius.full
#      └─ derived by rule radius-scale(full)@standard@1
#         inputs: semantic.radius.md = 0.5rem
#          └─ authored
#
# consumed by bootstrap:
#   $btn-border-radius             native
#   $navbar-toggler-border-radius  derived  via $btn-border-radius
```

- `--variable` finds the variable in the target's [coverage report](/docs/concepts/#5-provenance-and-coverage), follows the variables it is chained to (Bootstrap's own `!default` chain, a `var(--bs-*)` alias), and explains each slot it reaches. Bootstrap names work with or without `$`; a nested preset path works too (`--variable components.button.root.borderRadius --target primeng`). An unknown name exits 2 with the 5 nearest names of that target.
- A variable that reads no slot (dropped, unsupported, computed privately by the exporter) prints its class and the reason, and exits 0. A chain that reaches a variable the target doesn't drive ends with `(no coverage row names it)`: the target leaves that variable at the framework's default, or covers it only in a summary row.
- `explain <slot> --target <t>` lists the target's variables that consume the slot, directly or through a chain. When none names it, it says whether the target still reads the slot as an input to some other value, or doesn't read it at all.
- Without `--variable`, a name that is not a catalog slot is looked up as a variable of the target; a catalog slot always wins.
- `--mode` applies to the provenance trees, and `--json` prints everything as data on stdout.

### `transtyle bindings --expand`

Prints the config's [`bindings`](/docs/configuration/#binding-rules) pattern rules as the plain alias token file they expand to, on stdout, so you can freeze them: `npx transtyle bindings --expand > tokens/transtyle.bindings.tokens.json`, then delete the `bindings` key and list the file in `tokens`. On stderr it says, per rule, how many slots it skipped and why (already authored, bound by an earlier rule, target missing). It exits 2 without `--expand` or when the config has no rules, and 1 when a rule is malformed (`TST1117`) or a required one misses its target (`TST1118`).

### `transtyle bind --suggest`

Drafts the bindings of an existing design system: for every catalog slot nothing binds yet, the project token that fills it, read from your own token names and colors ([adopting an existing system](/docs/adopt-existing/), step 3). Deterministic, offline, byte-identical on every run: a versioned name table (`synonyms@1`) plus color measurements, no model.

```bash
npx transtyle bind --suggest --cwd examples/cathode   # with its bindings file left out of the config
# Proposed (9):
#   semantic.color.border               ← semantic.color.crt.scanline  medium  low chroma, 1.6 | 1.4:1 on the page; next: option.color.paper.rule
#   semantic.color.primary.solid        ← semantic.color.crt.ink       low     chroma 0.24 in dark; next: semantic.color.crt.meltdown
#   semantic.color.text.base            ← semantic.color.crt.ink       high    name "ink" → text.base; 14.6 | 13.5:1 on the page; …
#   semantic.color.warning.solid        ← semantic.color.crt.amber     medium  hue 5° | 5° off the warning anchor (85), …
#   ...
```

- **What it proposes**: the role `.solid`s but `neutral`, the text rungs, `elevation.0/1.surface`, `border`, `ring`, `link.*`, `font.sans/mono/display`. Candidates are your own `semantic.*` tokens; an `option.*` token only on name evidence, at `low`. A slot already authored or aliased (by a file or a `bindings` rule) is left alone.
- **How**: a name is read by structure, not similarity: a family word (text, link, focus, surface, border) decides before a role word, so `text-primary` is a text rung, not the brand, and `focus-text` is no text slot. A value is checked against the slot's shape in every mode (the page is low chroma at the end of the lightness range, a border sits 1.2–3:1 off it, body text reads at 4.5:1), or against what derivation would give the slot; a status color is matched on hue against its role's anchor.
- **Confidence**: `high` when name and value agree, `medium` for one of them, `low` for `primary` on value alone (one mode decides it) or an `option.*` token. Two candidates nothing separates are **contested**: listed on stderr and in the file's `$description`, never written as an alias.
- **Output**: stdout is a token file, each alias carrying its reason in `$description`; redirect it to a file, review it, then add it to `tokens`. `--rules` prints the same proposals as `{ "bindings": [...] }` [rules](/docs/configuration/#binding-rules) for the config, generalized with `{role}`, `{rung}` or `{level}` where your names are regular and checked to expand to exactly the same aliases. `--json` prints the whole report (every slot `bound`, `proposed`, `contested` or `none`, with its ranked candidates). The table above goes to stderr.
- It writes nothing. It exits 2 without `--suggest`, with an argument, or with both `--rules` and `--json`; 1 when the config or a token file can't be loaded. A missing `primary.solid` is no error here: that's usually why you're binding.

### `transtyle diff [ref]`

Semantic diff of the **resolved** token graph against a git ref (default `HEAD`), plus per-target impact. It compiles both the working tree and the project at the ref and compares resolved values per mode — so a token rename that changes no resolved value reports nothing, while one authored change shows its full derived cascade.

```bash
npx transtyle diff              # what have I changed since my last commit?
npx transtyle diff main         # what does this branch do to the compiled themes?
#
# Semantic diff vs main:
# [light]
#   ~ semantic.color.primary.solid  oklch(0.55 0.18 255)  [#026fd7] → oklch(0.55 0.19 25)  [#ca3535]
#   ...
# Per-target impact:
#   bootstrap: 63 lines changed
#   shadcn: 34 lines changed
```

It also flags **contrast regressions** — pairs that passed your configured WCAG standard before the change and fail after it:

```
⚠ Contrast regressions:
  ✖ text.base on elevation.0.surface (light): 18.1:1 → 2.2:1 — now FAILS 4.5:1
```

That's the difference between `check` ("contrast is bad") and `diff` ("_this change_ made it bad") — the second is what a green CI baseline can otherwise lose silently.

Exits `0` when the compiled themes are identical, `1` when there are changes (composes in CI like `git diff --exit-code`), `2` on a missing repo/unknown ref. `--json` prints a machine-readable report to stdout for PR tooling, including a `contrastRegressions` array. Full contract: [the diff spec](https://github.com/transtyle/transtyle/blob/main/docs/specs/diff.md).

### `transtyle catalog [--json]`

Lists every slot of the catalog — the vocabulary exporters bind to — with its DTCG type, the rule that fills it when you don't author it, that rule's inputs, and the optional anchor it needs. It reads no project (run it anywhere; `--cwd` is ignored): the catalog belongs to the language and the rule pack, not to a design system.

<!-- measured: catalog.slots = 259 -->
<!-- measured: catalog.semantic = 252 -->
<!-- measured: catalog.component = 7 -->

```bash
npx transtyle catalog
#
# Transtyle catalog — IR spec v0-draft, rule pack standard@1
# 259 slots: 252 semantic, 7 component (168 derived, 84 defaulted, 7 authored only)
# ...
# semantic · radius (8)
#   semantic.radius.full   dimension  derived by radius-scale(full)  (needs semantic.radius.md)
#   semantic.radius.md     dimension  author it
```

`--json` prints the same catalog for tools, one object on stdout. The output is deterministic — the same bytes on every run and machine — so it can be committed, diffed, or cached:

```json
{
  "irSpec": "v0-draft",
  "rulePack": "standard@1",
  "counts": {
    "slots": 259,
    "semantic": 252,
    "component": 7,
    "derived": 168,
    "defaulted": 84,
    "authoredOnly": 7
  },
  "roles": ["primary", "secondary", "..."],
  "cells": ["solid", "solid-hover", "..."],
  "slots": [
    {
      "path": "semantic.color.primary.on-tint",
      "tier": "semantic",
      "group": "role",
      "type": "color",
      "kind": "derived",
      "rule": "contrast-pick(subtle)",
      "inputs": ["semantic.color.primary.tint"],
      "requires": [],
      "role": "primary",
      "cell": "on-tint"
    }
  ]
}
```

- `kind` is `derived` (a rule computes it from other slots), `defaulted` (a catalog default: a constant, or a projection of other defaults like `type.role.*`) or `authored-only` (no rule: `primary.solid`, `border`, `radius.md`, the fonts, `component.tooltip.max-width`). Authored always wins, whatever the kind.
- `rule` and `inputs` are what [`transtyle explain`](#transtyle-explain-slot---mode-name) prints for an unauthored slot, with full paths; `rule` is `null` for an authored-only slot.
- `requires` names the optional anchor without which the slot doesn't exist (the radius family and the component radii need `radius.md`). `semantic.color.primary.solid` is required by everything and never listed.
- `role` and `cell` are set on role-grid slots only. A custom role that declares an [archetype](/docs/language/#elevation-content-and-the-rest) gets the same `cells` as a built-in one.
- Slots are sorted by path, numeric segments as numbers.

The same object is `catalog()` in `@transtyle/core`.

### `transtyle init [name]`

Scaffolds `transtyle.config.json` and your token files from five answers. In a terminal it asks for them; each also has a flag, and a flag you pass skips its question:

| Flag               | Asks for                                                                                                                                                                                              | Default                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--brand <color>`  | Your brand color, in any CSS color syntax (`#e8590c`, `oklch(…)`, `rgb(…)`, a name)                                                                                                                   | `oklch(0.55 0.18 255)` |
| `--schemes <set>`  | `light,dark` or `light`                                                                                                                                                                               | `light,dark`           |
| `--targets <list>` | Which of the eleven targets to configure, comma-separated (`shadcn,bootstrap`)                                                                                                                        | `css-variables`        |
| `--preset <name>`  | `recommended`: brand color, page and card backgrounds, text, muted text, border, radius and fonts, with dark values; `minimal`: the brand color only                                                  | `recommended`          |
| `--layout <name>`  | `single`: one token file plus a dark overlay; `layered`: your own names, a dark overlay, and a bindings file ([the layered layout](/docs/authoring-tokens/#the-layered-layout-recommended-for-teams)) | `single`               |
| `--yes`, `-y`      | Ask nothing and take the defaults                                                                                                                                                                     |                        |

```bash
npx transtyle init --brand '#e8590c' --targets shadcn,bootstrap --yes
```

Without a terminal (CI, a script, an agent), `init` asks nothing and never reads stdin: unset answers take their defaults. A wrong value exits 2 and names the valid ones, before any file is written; at a prompt, a wrong answer is asked again.

The `recommended` neutrals are a starting ladder in your brand's hue, light and dark, each with a `$description: "TODO: ..."` placeholder: authored values in your file, there to be replaced. Token files are listed by name in the config, the dark one as a [mode-scoped overlay](/docs/authoring-tokens/#modes), and each starts with a `$schema` line for [editor autocomplete](/docs/configuration/#token-files-in-your-editor). The same answers always write the same bytes.

`init` then checks what it wrote, prints any diagnostics, shows your brand color with the `on-solid` text color derived for it and their contrast ratio, and lists what is worth authoring next. Refuses (exit 2) if a config or one of the token files already exists.

### `transtyle add <target>`

Validates the target against the CLI's known exporters and inserts `"<target>": { "output": "dist/<target>" }` into the existing config. Refuses (exit 2) for an unknown or already-configured target.

### `transtyle migrate --from style-dictionary [--write]`

Rewrites [Style Dictionary](https://styledictionary.com/) v3 token files (`value`/`type` without the `$`) to DTCG, the format Transtyle reads. It is what the [`TST1307`](/docs/diagnostics/#diagnostic-code-reference) error points you to. Without `--write` it prints a diff per file and changes nothing; with it, the files are rewritten in place. It reads the files your config's `tokens` list matches, and leaves any file that is not Style Dictionary v3 alone, so running it twice changes nothing the second time.

```bash
npx transtyle migrate --from style-dictionary          # diff only
npx transtyle migrate --from style-dictionary --write  # apply
npx transtyle check
```

What it changes:

- `value` → `$value`, `type` → `$type`, `comment` → `$description`.
- `{color.brand.primary.value}` → `{color.brand.primary}`: the trailing `.value` of a reference goes.
- Style Dictionary type names become DTCG ones (`size` → `dimension`, `fontFamilies` → `fontFamily`, `fontWeights` → `fontWeight`, `boxShadow` → `shadow`). A token with no `type`, which is the usual case since the category is the top-level key, gets its `$type` from that key when it is one of those names; the output says so.
- Build metadata (`attributes`, `name`, `filePath`, `isSource`, `original`, `path`) is kept, under `$extensions["style-dictionary"]`, so nothing is lost silently.
- Style Dictionary has no tiers, so every top-level group moves under `option` and references follow (`{option.color.brand.primary}`). Binding the `semantic` tokens, at least `semantic.color.primary.solid`, is yours to do: Transtyle does not guess it.

The files are re-serialized with their own indentation, and the diff compares the file before and after that, so only real changes show. Exit `0` when it ran, `1` if a token file does not parse (nothing is written), `2` for a usage or config error (no `--from`, an unknown source, no config). It does not read Style Dictionary's `config.json` platforms, and Style Dictionary v4 files that already use `$value` load as they are.

## Exit codes

| Code | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| 0    | Success (possibly with warnings below your `check.failOn` threshold)     |
| 1    | Diagnostics at or above the `failOn` threshold                           |
| 2    | Usage or config error (unknown command, missing config, broken exporter) |

`transtyle diff` overloads exit `1` to mean "changes found" (like `git diff --exit-code`), not a diagnostic failure.

## Diagnostics format

Every diagnostic has a stable code, printed with severity:

```
⚠ TST2101 text.muted vs elevation.1.surface is 4.4:1 in light mode (< 4.5:1 wcag21-aa)
✖ TST1104 Alias cycle: semantic.color.a → semantic.color.b → semantic.color.a
```

The full code table lives in [Weird things & diagnostics](/docs/diagnostics/#diagnostic-code-reference).

## Specced, not yet implemented

These exist as design (see [Status & roadmap](/docs/roadmap/)) and will keep the same principles when they land:

| Command                                        | What it will do                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `transtyle add <exporter>` (community plugins) | Install + register third-party exporter packages, printing their manifest first         |
| `transtyle import <source>`                    | Materialize an importer's output (Figma, Tailwind, Bootstrap) as reviewable token files |
| `transtyle preview`                            | Local themed preview site across all targets                                            |

Programmatic use: `build`, `check`, `diff`, `explain`, `catalog`, `bind --suggest` and `migrate --from style-dictionary` wrap `@transtyle/core`'s public API (`compile()`, `diffResolved()`, `explainToken()`, `explainVariable()`, `slotConsumers()`, `catalog()`, `suggestBindings()`, `migrateStyleDictionary()`), so a build-tool integration can reach the same logic. `init` and `add` only scaffold files and rewrite the config, so they stay CLI-only (`parseColor`, which `init` validates the brand with, is exported).
