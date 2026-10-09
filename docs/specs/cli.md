# CLI specification

> **Status:** `build`, `check`, `explain`, `bindings --expand`, `init`, `add`, `diff`, `catalog` are implemented (`packages/cli/src/main.js`; golden-tested by `scripts/check-cli.mjs`) — a real subset of the full surface below, not yet the whole vision. Implemented `init` asks for the brand color, color schemes, targets, preset and file layout on a terminal, takes each from a flag (`--brand`, `--schemes`, `--targets`, `--preset`, `--layout`, `--yes`) and never asks without one, then checks what it wrote (see [`init`](#init) below); `add <target>` validates against the CLI's own exporter registry and read-modify-writes the config; `explain <slot> [--mode <name>]` prints the resolved value, provenance, and rule inputs recursively (see the corrected example below — no `--target` filtering or WCAG candidate list yet, and there's no per-token file:line tracking in provenance); `check --json` prints the diagnostics array, the `suppressed` list + per-target coverage to stdout as one JSON object (human logs still go to stderr); a diagnostic about an authored token prints its location after the code (`✖ TST1105 tokens/brand.tokens.json:17:9 …`) and carries `path`, `file`, `line`, `column` in the JSON, and `check.suppress` silences warnings and infos (see [validation-and-coverage.md](validation-and-coverage.md#suppressions)); `catalog [--json]` prints the catalog (below); `check --matrix` prints which targets read each catalog slot (below), and adds it to the `--json` object as `matrix`. `--out`, `--dry-run` remain specced, not implemented ([issue #5](https://github.com/transtyle/transtyle/issues/5)); `--frozen` likewise ([issue #1](https://github.com/transtyle/transtyle/issues/1)); `import`, `migrate` wait on the importer contract (ROADMAP I1/I2, Phase 3).

## Design corrections from the original vision

The pitched invocation was `npx @transtyle/translate bootstrap 5.3.8`. Three changes, each deliberate:

1. **One binary, subcommands** (`transtyle build`), not per-action packages. Per-action packages fragment docs, version skew between them is user-hostile, and every serious tool in the reference class (git, terraform, cargo, babel) converged on one binary.
2. **Targets live in config; CLI selects.** `transtyle build` builds everything configured; `transtyle build bootstrap` filters. Version pinning belongs in config (reviewed, locked), with `@version` as an ad-hoc override — inverting this ("version only on CLI") makes builds unreproducible.
3. **Range-based version targeting**, not patch promises ([ADR-0006](../adr/0006-version-ranges.md)).

## Command surface (v1)

```
transtyle init [name]               scaffold tokens/ + transtyle.config.json (asks on a terminal; a flag per question, --yes for defaults)
transtyle add <plugin>...           install + register exporters/importers (resolves @transtyle/exporter-<name>,
                              falls back to exact npm name for community plugins; prints manifest before install)
transtyle build [target...]         compile (all targets or listed subset)
      --out <dir>             override output root
      --frozen                fail on lockfile drift (default in CI)
      --dry-run               full pipeline, print file list + coverage, write nothing
transtyle check [target...]         pipeline minus emit: validation, contrast, coverage, drift detection
      --fail-on <level>       override config policy (error|warning|approximation)
      --json                  machine-readable report to stdout
      --matrix                slot × target consumption matrix: which targets read each catalog slot
transtyle explain <token> [--target <t>] [--mode <dim>=<v>]
                              provenance chain: authored where / derived by which rule from what /
                              mapped to which target variable and why
transtyle bindings --expand           print the config's `bindings` pattern rules as the plain alias token file they expand to
                                      (stdout; what each rule skipped goes to stderr)
transtyle import <source> [--write] materialize an importer's output as token files (review, then adopt)
transtyle diff [<git-ref>]          semantic diff of resolved IR vs ref (default: HEAD); per-target impact summary
transtyle catalog [--json]          every catalog slot: type, derivation rule and inputs, required anchor (no project needed)
transtyle migrate                   apply codemods across IR-spec / rule-pack upgrades
```

Phase 2+: `transtyle preview` (local themed preview server), `transtyle doc <target>` (experimental; [doc-generation.md](doc-generation.md)), `transtyle watch` (or `build --watch`).

## `init`

`transtyle init [name]` writes `transtyle.config.json` and the token files from five answers. Each answer has a flag; a flag given skips its question:

| Flag               | Values                                                                                  | Default                |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------- |
| `--brand <color>`  | any color `parseColor` reads, opaque                                                    | `oklch(0.55 0.18 255)` |
| `--schemes <set>`  | `light,dark` or `light`                                                                 | `light,dark`           |
| `--targets <list>` | comma-separated names from the exporter registry, the same list `add` validates against | `css-variables`        |
| `--preset <name>`  | `recommended`, `minimal`                                                                | `recommended`          |
| `--layout <name>`  | `single`, `layered`                                                                     | `single`               |
| `--yes`, `-y`      | ask nothing, take the default for every answer no flag gave                             |                        |

- **Questions only on a terminal.** `init` asks when stdin and stderr are both TTYs and `--yes` is absent, on stderr like every other human log. Otherwise it never reads stdin: scripts and CI get the defaults plus their flags. A multi-choice question takes numbers or names (`1,4` or `shadcn,bootstrap`), not arrow keys, so the CLI stays dependency-free (`node:readline`).
- **Validated before anything is written.** A bad flag (unknown target, preset, layout or scheme set, a color that doesn't parse or isn't opaque, a flag without its value) exits 2 naming the valid values; a bad answer at a prompt is explained and asked again; input that ends before the last answer exits 2. An existing config or token file is never overwritten (exit 2). Init flags on another command exit 2.
- **Presets.** `recommended` authors `primary.solid` (aliasing `option.color.brand.500`), `elevation.0.surface`, `elevation.1.surface`, `text.base`, `text.muted`, `border`, `radius.md`, `font.sans`, `font.mono`, each color with a `TODO` `$description`. The neutrals are a fixed lightness ladder at low chroma in the brand's hue (chroma 0 for a gray brand), with a dark value for each when the schemes include dark. They are authored values in the user's file, not derivation, so `autoDark` stays off. `minimal` authors the brand color only; everything else derives or [defaults](../architecture/derivation.md).
- **Layouts.** `single` writes `tokens/brand.tokens.json` in the catalog's names, plus `tokens/brand.dark.tokens.json` (a mode-scoped overlay) when there are dark values. `layered` writes the adoption guide's three kinds of files: `tokens/brand.tokens.json` holds the palette and the user's own names (`semantic.color.ui.*`), `tokens/brand.dark.tokens.json` their dark values, `tokens/transtyle.bindings.tokens.json` the catalog slots aliased to them. Every token file is listed by name in `tokens` (no glob) and starts with the token-file `$schema` line.
- **Deterministic.** The same answers give byte-identical files; targets are written in registry order whatever order they were typed in.
- **Closing check.** After writing, `init` runs the `check` pipeline on the new project, prints its diagnostics and counts, the brand with its derived `primary.on-solid` and their contrast ratio (rounded down; a truecolor chip when stderr is a TTY and `NO_COLOR` is unset), and what to author next. Warnings don't change the exit code; an error makes it 1.

## `explain` — the trust command

The feature that makes derivation acceptable. Real output, implemented today (accepts the slot with or without the `semantic.`/`semantic.color.` prefix; `--mode` selects a mode other than the DS's default):

```
$ transtyle explain primary.on-tint
semantic.color.primary.on-tint = oklch(0.48 0.162 255)  [#005bb6]
 └─ derived by rule contrast-pick(subtle)@standard@1
    inputs: semantic.color.primary.tint = oklch(0.95 0.017 255)  [#e7effa]
     └─ derived by rule mix-toward-surface(0.92)@standard@1
        inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
         └─ aliased → option.color.blue.600
        inputs: semantic.color.elevation.1.surface = oklch(0.985 0.003 255)  [#f9fafc]
         └─ aliased → option.color.gray.50
```

An unknown slot exits 2 and lists the 5 closest catalog names (Levenshtein distance) instead of a bare error — e.g. asking for the pre-revision `primary.subtle` surfaces `primary.tint`, `primary.outline`, `primary.on-tint`. `--target` filtering, per-token file:line provenance, and the WCAG candidate list shown in the original mockup above remain specced.

`explain` also names the rule behind a slot that a `bindings` rule produced: `└─ aliased → option.color.primary.50  (from rule bindings[2]: semantic.color.{role}.tint)`. `transtyle bindings --expand` is a thin wrapper over `compile()`'s `bindings` result (`expandBindings()` in core); see [configuration.md](configuration.md#binding-rules).

## `catalog` — the contract as data

The semantic contract ([ir.md](../architecture/ir.md#the-semantic-contract)) as one machine-readable object, so editors, the playground, agents and the token-file schema ([issue #64](https://github.com/transtyle/transtyle/issues/64)) stop re-deriving it from prose and source. `transtyle catalog --json` prints `catalog()` from `@transtyle/core` with `JSON.stringify(…, null, 2)`; without `--json`, a table per group (path, type, rule or "author it", required anchor). Both go to stdout. It reads no config and ignores `--cwd`: the catalog belongs to the IR spec and the rule pack, not to a project. A positional argument is a usage error (exit 2).

```
{ irSpec, rulePack, counts: { slots, semantic, component, derived, defaulted, authoredOnly },
  roles: [...COLOR_ROLES], cells: [...GRID_CELLS],
  slots: [ { path, tier, group, type, kind, rule, inputs, requires, role?, cell? }, ... ] }
```

- `tier` is `semantic` or `component`; `group` is the role grid (`role`), the next path segment under `semantic.color.` (`elevation`, `scrim`, `text`, `link`, `border`, `ring`), the one under `semantic.` (`radius`, `space`, `type`, …), or the component's name.
- `kind` is `derived`, `defaulted` (provenance kinds, [derivation.md](../architecture/derivation.md)) or `authored-only` (no rule fills it). `rule` is the rule name without the `@standard@1` suffix (that is `rulePack`), `null` when authored-only; `inputs` are full slot paths.
- `requires` lists the optional anchors the slot needs to exist (today only `semantic.radius.md`, for the radius family and the component radii; an anchor the engine can fill itself, like `semantic.color.text.base` defaulted from the canvas, is required by nothing and is described by its rule). `semantic.color.primary.solid` is required by every derived slot (TST1201) and never listed.
- `role` and `cell` are present on role-grid slots only. `roles` and `cells` are what a consumer needs to expand the grid for a project's own archetyped roles, which get the same cells ([ir.md](../architecture/ir.md#color-the-role-grid)).
- Slots are sorted by path, segment by segment, numeric segments as numbers. The output is byte-identical on every run.

**How it is built: a probe compile.** `catalog()` runs NORMALIZE + DERIVE in memory on a built-in design system that authors every anchor with a placeholder value, in light and dark, and reads path, type and provenance off the result; `requires` comes from one more probe per optional anchor, with that anchor left out. So the catalog can't disagree with the engine, and nothing in `derive.js` had to be restated as a table. It fails loudly if light and dark ever disagree on a slot's set or rule. The trade-off: rule names carry whatever parameters the engine records (`mix-toward-surface(0.92)`), and a slot's inputs are the ones its provenance names (the categorical palette names only `primary.solid`).

`scripts/check-grid.mjs` compiles Acme against it both ways (every rule-filled catalog slot resolves in both modes; every slot the engine fills is in the catalog), and `scripts/check-docs.mjs` holds the language page's slot tables to it. Per-target consumers are not part of it: which targets read a slot depends on the project's targets and needs their exporters to run, which `catalog` never does. `check --matrix` (below) answers it from a project's own compile.

## `check --matrix` — who reads a slot

`explain` answers "where does this value come from"; `check --matrix` answers the reverse question an author asks before touching a slot: "if I author `elevation.3.surface`, which targets change?" ([issue #95](https://github.com/transtyle/transtyle/issues/95)).

Coverage rows can't answer it. A row's `slot` is a label for humans, often not a catalog path: ECharts names its palette as one range row (`semantic.palette.categorical.1–8`), Radix names its ramps with role wildcards (`semantic.color.primary.*`), Bootstrap answers most rows "via driven roots", PrimeNG has brace patterns. Matching those labels against catalog paths found 8 of the 82 slots Radix reads on Acme, and 54 of PrimeNG's 96.

So the CLI records reads instead (`packages/cli/src/matrix.js`). While an exporter's `emit()` runs, each resolved mode map it receives is a recording `Map` that notes every slot looked up with `get` or `has`, and every entry the exporter opens while iterating. Listing keys is not a read: css-variables walks every key and keeps the `semantic.*` ones, and only those it then reads count. The IR the exporter sees is unchanged (same keys, same entries, `modes.light` still the same object as its combo map), the exporter needs no change, and a third-party exporter gets it for free. The wrapping lives in the CLI's exporter loader, not in core: `compile()` already takes the loader as a parameter.

Each reader is classed from that target's coverage rows that name the slot exactly, best first (`native`, `derived`, `approximated`). A read slot no row names is `input`: it feeds a value described under another slot or a pattern. This over-approximates in the safe direction: an exporter that reads a slot and discards it still counts as a reader, so an empty cell is a guarantee.

- Human output: one block per catalog section (each role of the grid, then the other semantic groups, then components), one line per slot with "read by n/N" and the readers.
- `--json`: the check report gains `matrix: { targets, slots }`, where `slots[slot][target] = { class, variables }` for each target that read it (`variables`: the coverage rows naming the slot) and `{}` for a slot nobody reads. Keys sorted; the output is deterministic.
- The docs page `website/src/docs/slot-matrix.md` is this matrix for Acme and every official exporter, generated by `scripts/gen-matrix.mjs` and guarded by `check:matrix`.
- Specced, not implemented: `reads` in each target's `report.json` (it needs core to record reads itself) and the downstream closure (authoring `elevation.3.surface` also changes `.4` and `.5`, which derive from it; the matrix shows direct readers only).

## Behavioral contracts

- **Exit codes:** 0 success; 1 diagnostics at/above the fail-on threshold; 2 usage/config errors. Stable, documented, CI-safe. An exporter that throws is not a usage error: it becomes a `TST3001` error diagnostic naming the target, the other targets still run so every crash is reported, nothing is written to disk (atomic EMIT), and the run exits 1 (`TST3002` for an exporter that cannot be loaded). `TRANSTYLE_DEBUG=1` prints the stack under the message. `explain` loads and runs no exporter, so a broken one cannot fail it.
- **Output streams:** human logs → stderr; requested data (`--json`, `explain`) → stdout. Pipeable by construction.
- **Non-interactive by default** when not a TTY; anything interactive has a flag equivalent. `init` is the only command that asks (above).
- **No telemetry.** If ever proposed, opt-in only, and it gets its own ADR and public schema.
- **Specced:** `NO_COLOR`, `--quiet` and `--verbose` — none is read today except `NO_COLOR` by `init`'s color chip ([issue #5](https://github.com/transtyle/transtyle/issues/5)). Output volume is fixed, and an unknown flag exits 2 rather than being ignored, so a script passing one of these fails loudly instead of silently getting the same output.

## Programmatic parity

The goal is that every command that computes something be a thin wrapper over `@transtyle/core`'s public API, so the CLI never holds logic a build-tool integration cannot reach. `build` and `check` are `compile({ emit })`, `diff` is `compile()` twice plus `diffResolved()`/`contrastRegressions()`, `catalog` is `catalog()`, and `explain` is `compile({ emit: false })` plus `explainToken(normalized, slot, { mode })`, which returns the provenance walk as a JSON-serialisable tree (`{ slot, mode, entry, inputs }`, with `seen`, `unresolved` and `truncated` markers) and throws an `Error` with a `code` of `unknown-mode` (`available`) or `unknown-slot` (`closest`); the CLI only formats the tree. `init` and `add` are **CLI-only on purpose**: they scaffold files and rewrite the config, and `add` validates against the CLI's own list of official exporters, which core deliberately does not know.
