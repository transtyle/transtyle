# CLI specification

> **Status:** `build`, `check`, `explain`, `bindings --expand`, `init`, `add`, `diff`, `catalog`, `bind --suggest`, `migrate --from style-dictionary` are implemented (`packages/cli/src/main.js`; golden-tested by `scripts/check-cli.mjs`) — a real subset of the full surface below, not yet the whole vision. Implemented `init` asks for the brand color, color schemes, targets, preset and file layout on a terminal, takes each from a flag (`--brand`, `--schemes`, `--targets`, `--preset`, `--layout`, `--yes`) and never asks without one, then checks what it wrote (see [`init`](#init) below); `add <target>` validates against the CLI's own exporter registry and read-modify-writes the config; `explain <slot> [--mode <name>]` prints the resolved value, provenance, rule inputs and alias targets recursively (see the corrected example below), `explain <slot> --target <t>` adds the target variables that consume the slot, and `explain --variable <name> --target <t>` goes the other way, from a target variable to its slot(s) (no WCAG candidate list yet; per-token file:line provenance exists only for tokens loaded from a Tokens Studio export, which `explain` prints as `from <file>:<line>:<column> (Tokens Studio set "<set>", <path>)`, with a math token's expression after `authored  ←`); `check --json` prints the diagnostics array, the `suppressed` list + per-target coverage to stdout as one JSON object (human logs still go to stderr); a diagnostic about an authored token prints its location after the code (`✖ TST1105 tokens/brand.tokens.json:17:9 …`) and carries `path`, `file`, `line`, `column` in the JSON, and `check.suppress` silences warnings and infos (see [validation-and-coverage.md](validation-and-coverage.md#suppressions)); `catalog [--json]` prints the catalog (below); `bind --suggest` proposes bindings from a project's own names and colors (below); `check --matrix` prints which targets read each catalog slot (below), and adds it to the `--json` object as `matrix`; `build` and `check` print one `authored n/m <level>` line, and `check --completeness <level>` lists what to author next (below), added to the `--json` object as `completeness`. `build --out <dir>` (each target to `<dir>/<name>`), `build --dry-run`, `--quiet`, `--verbose` (build and check) are implemented, and `NO_COLOR` is honored (see Behavioral contracts); `--frozen` is still specced, not implemented ([issue #1](https://github.com/transtyle/transtyle/issues/1)); `import` waits on the importer contract (ROADMAP I1/I2, Phase 3), and so does `migrate` without `--from` (the IR-spec / rule-pack upgrade codemods; `migrate` implements only `--from style-dictionary` today).

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
      --out <dir>             write target <name> to <dir>/<name> instead of its configured output
      --frozen                fail on lockfile drift (default in CI)
      --dry-run               full pipeline, print file list + coverage, write nothing
      --quiet | --verbose     less output (errors and failure causes only) | more (exporter, options, output dir, file sizes, stack on a fatal error)
transtyle check [target...]         pipeline minus emit: validation, contrast, coverage, drift detection
      --fail-on <level>       override config policy (error|warning|approximation)
      --json                  machine-readable report to stdout
      --matrix                slot × target consumption matrix: which targets read each catalog slot
      --completeness <level>  what to author next for minimal|recommended|complete, in order
transtyle explain <token> [--target <t>] [--mode <dim>=<v>] [--json]
                              provenance chain: authored where / derived by which rule from what /
                              mapped to which target variable and why
transtyle explain --variable <name> --target <t>
                              reverse lookup: from a target variable to the slot(s) it reads, then their provenance
transtyle bindings --expand           print the config's `bindings` pattern rules as the plain alias token file they expand to
                                      (stdout; what each rule skipped goes to stderr)
transtyle bind --suggest [--rules|--json]
                              propose bindings for unbound catalog slots from the project's own token names and colors:
                              an annotated alias token file, or `bindings` rules, on stdout; the reasons on stderr
transtyle import <source> [--write] materialize an importer's output as token files (review, then adopt)
transtyle diff [<git-ref>]          semantic diff of resolved IR vs ref (default: HEAD); per-target impact summary
transtyle catalog [--json]          every catalog slot: type, derivation rule and inputs, required anchor (no project needed)
transtyle migrate                   apply codemods across IR-spec / rule-pack upgrades (specced; needs --from today)
transtyle migrate --from style-dictionary [--write]
                                    rewrite Style Dictionary v3 token files (value/type) to DTCG ($value/$type); dry run unless --write
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
             └─ authored
        inputs: semantic.color.elevation.1.surface = oklch(0.985 0.003 255)  [#f9fafc]
         └─ aliased → option.color.gray.50
             └─ authored
```

An alias is followed to its target, one level in, without repeating the value (it is the same): `component.button.radius` shows `aliased → semantic.radius.full`, then how `semantic.radius.full` is derived from the authored `semantic.radius.md`. Aliases don't count toward the depth limit of three levels of rule inputs. A rule that reads another mode records it (`provenance.inputMode`: `text.inverse` reads the other color scheme's `text.base`, `swap-neutrals` the default mode's page and text), and `explain` walks its inputs in that mode and names it after the path, `inputs: semantic.color.text.base (light) = …`; `explainToken()` gives those inputs a `mode`.

An unknown slot exits 2 and lists the 5 closest catalog names (Levenshtein distance) instead of a bare error — e.g. asking for the pre-revision `primary.subtle` surfaces `primary.tint`, `primary.outline`, `primary.on-tint`. Per-token file:line provenance and the WCAG candidate list shown in the original mockup above remain specced.

`explain` prints a token's own `$description` and `$deprecated` under its value line (`  description: …`, `  deprecated: <reason>`), and under each input it walks; a deprecated token further down the alias chain gets a `  via deprecated <token>: <reason>` line (`deprecationsReached()` in core, the walk behind `TST1122`). See [validation-and-coverage.md](validation-and-coverage.md#token-metadata-description-and-deprecated).

`explain` also names the rule behind a slot that a `bindings` rule produced: `└─ aliased → option.color.primary.50  (from rule bindings[2]: semantic.color.{role}.tint)`. `transtyle bindings --expand` is a thin wrapper over `compile()`'s `bindings` result (`expandBindings()` in core); see [configuration.md](configuration.md#binding-rules).

A token loaded from a Tokens Studio export ([configuration.md](configuration.md#tokens-studio-exports)) names the set file and the path designers know it by, per mode, and a math token shows its expression. A catalog slot bound to such a token shows it one level in, through the alias:

```
$ transtyle explain option.space.md
option.space.md = 16px
 └─ authored  ← {option.space.base} * 4
    from export/core.json:59:5 (Tokens Studio set "core", space.md)
$ transtyle explain primary.solid --mode dark
semantic.color.primary.solid = oklch(0.714 0.143 254.6)  [#60a5fa]
 └─ aliased → semantic.color.action.default
     └─ aliased → option.color.blue.400
        from export/semantic/dark.json:30:7 (Tokens Studio set "semantic/dark", color.action.default)
         └─ authored
            from export/core.json:38:7 (Tokens Studio set "core", color.blue.400)
```

## `explain --target`, `--variable` — from a slot to target variables and back

The question a developer debugging a rendered page asks is the other direction: "why is `$btn-border-radius` 9999px?" ([issue #98](https://github.com/transtyle/transtyle/issues/98)). `--target <t>` takes a target instance (the config key, so `shadcn-v3` works); the CLI compiles that one target without writing (`emit: false`) and reads its coverage rows, so no prior build is needed.

```
$ transtyle explain --variable '$form-select-border-radius' --target bootstrap
bootstrap:
  $form-select-border-radius  derived  via $input-border-radius
    $input-border-radius  derived  → component.control.radius

component.control.radius = 0.5rem
 └─ derived by rule alias(radius.control)@standard@1
    inputs: semantic.radius.control = 0.5rem
     └─ derived by rule alias(radius.md)@standard@1
        inputs: semantic.radius.md = 0.5rem
         └─ authored

$ transtyle explain component.button.radius --target bootstrap
component.button.radius = 9999px
 └─ aliased → semantic.radius.full
     └─ derived by rule radius-scale(full)@standard@1
        inputs: semantic.radius.md = 0.5rem
         └─ authored

consumed by bootstrap:
  $btn-border-radius             native
  $navbar-toggler-border-radius  derived  via $btn-border-radius
```

- **What a row reads.** A coverage row's `slot` is a label. The lookup reads the row's structured fields instead ([validation-and-coverage.md](validation-and-coverage.md#structured-fields-slots-and-via)): `slots` (the IR paths the variable reads), else `slot` when it is itself an IR path, and `via` (the target variables it follows). A row that reads no slot and follows nothing (dropped, unsupported, exporter-private, a wildcard such as Radix's `semantic.color.primary.*`) prints its class and note and exits 0: that is the honest answer.
- **`--variable <name>`** prints the variable's row(s), the rows its `via` chain reaches (at most 6 hops, cycle-safe), then the provenance tree of each slot reached. A `via` name with no row of its own (a variable the target leaves at its own default, or one only a summary row covers) ends the chain with `(no coverage row names it)`. Bootstrap names are accepted with or without `$`. An unknown variable exits 2 with the 5 nearest names of that target.
- **`explain <slot> --target <t>`** appends `consumed by <t>:` with each row whose slots name the slot, then the rows that reach it through `via` (with the chain). When no row names it, the target's `reads` (recorded by core, the data `check --matrix` below is built from) still tells "read as an input, no coverage row names it" from "not read".
- **A bare name with `--target`** that is not a catalog slot is looked up as a variable of the target. A catalog slot always wins, so `primary.solid` (the catalog) and `semantic.primary.50` (a PrimeNG variable) stay unambiguous; an unknown name exits 2 with both lists of near names.
- `--mode` applies to the provenance trees. The variable → slot mapping is the target's, read from one compile (Bootstrap resolves its Sass rows from the light map).
- `--json` prints the data to stdout: for a slot, `explainToken()`'s tree plus `target: { name, read, consumers }` (each consumer `{ variable, class, through }`); for a variable, `explainVariable()`'s result plus `mode` and `trees` (one `explainToken()` tree per slot reached). Deterministic, byte for byte.
- An unconfigured target is the `TST1301` error (with its "did you mean"), and exits 2. `--target` and `--variable` on any other command are usage errors.

## `migrate --from style-dictionary` — Style Dictionary v3 to DTCG

The codemod half of [issue #54](https://github.com/transtyle/transtyle/issues/54); the detection half is the `TST1307` error at LOAD, whose hint points here. A Style Dictionary v3 file (`value`/`type` without the `$`) has no DTCG token in it, so without this it would compile to an empty tree.

- **Which files.** The config's `tokens` globs (so it needs a `transtyle.config.json`; `--cwd` as everywhere). A file is migrated only when it has a Style Dictionary leaf and no `$value` anywhere, the same test as `TST1307`; every other file (DTCG, mixed, empty) is reported and left alone. That also makes a second run a no-op.
- **Dry run by default.** Without `--write` it prints, per file, a unified-style diff on stdout and touches nothing; with `--write` it rewrites in place (the `--write` convention `import` will share). The diff compares the file re-serialized before and after, so formatting never shows as a change; the written file uses the file's own indent (a tab, or the width of its first indented line, else two spaces) and a trailing newline. Integer-like keys (`"100"`) sort first within their object, as in any JavaScript object. Human notes go to stderr.
- **Transform rules** (core's `migrateStyleDictionary(tree)`, pure, no I/O, keys in their original order):
  - On a token (an object with a `value`, as `TST1307` detects it): `value` → `$value`, `type` → `$type`, `comment` → `$description`. A group that merely has a child called `value` stays a group.
  - References: a trailing `.value` is stripped (`{color.brand.primary.value}` → `{color.brand.primary}`), in every string of a value, composite values included.
  - Types: `size`, `sizing`, `spacing`, `dimension` → `dimension`; `fontFamilies`, `fontFamily` → `fontFamily`; `fontWeights`, `fontWeight` → `fontWeight`; `boxShadow` → `shadow`; `color` stays. A token with no `type` (the usual Style Dictionary v3 case: the category is the top-level key) gets `$type` from its top-level group when that group is one of those names, and the notes say so. Any other `type` is kept as `$type` and flagged (`TST1306` on the next check).
  - Everything else on a token (`attributes`, `name`, `filePath`, `isSource`, `original`, `path`, custom keys) is Style Dictionary build metadata; it moves under `$extensions["style-dictionary"]` instead of being dropped (`check` reports the foreign namespace once, `TST1304`).
  - Tiers: Style Dictionary has none, so every top-level group that is not `option`, `semantic` or `component` moves under `option`, and references to it follow (`{color.a}` → `{option.color.a}`). The command says that the `semantic` bindings (at least `semantic.color.primary.solid`) are the author's to add; it guesses none.
- **Exit codes.** 0 when it ran (changes pending or not); 1 when a token file does not parse (`TST1002`, and nothing is written); 2 for usage and config errors: no `--from`, an unknown source, an argument, `--from`/`--write` on another command, no config, a `tokens` that matches nothing.
- **Out of scope** (files separately if wanted): Style Dictionary v4 files that already use `$value` (they load today), `config.json` build platforms and tier guesses from them, transforms and formats, Tokens Studio JSON.
- **Programmatic parity.** The transform is `migrateStyleDictionary()` and the test `needsStyleDictionaryMigration()`, both exported by `@transtyle/core`, with `loadConfig()` and `expandTokenFiles()` for finding the files; the CLI adds the diff and the writes.
- **Graded by** `scripts/check-cli.mjs` against `packages/core/test-fixtures/style-dictionary-migrate`: the unmigrated fixture raises `TST1307`, a dry run leaves it byte-identical, `--write` produces a project that passes `check` and builds, a second run is a no-op, two projects migrate to the same bytes, and the transform rules are checked on their own.

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

## `bind --suggest` — a first draft of the bindings

Binding the catalog is the judgment step of adopting an existing design system ([adopt-existing](../../website/src/docs/adopt-existing.md), step 3), but most of it is mechanical: a token named `brand` is `primary.solid`, the low-chroma color at the end of the lightness range is the page. `transtyle bind --suggest` proposes, for every catalog slot in scope that nothing binds yet, the project token that fills it, with a confidence and the reason in words ([issue #60](https://github.com/transtyle/transtyle/issues/60)). It is a lookup table plus color arithmetic, not a model ([VISION](../../VISION.md) non-goal 5): no network, no randomness, byte-identical output on every run.

- **Scope.** The color slots adopters bind (`primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info` `.solid`; the six text rungs; `elevation.0/1.surface`; `border`; `ring`; `link.base/hover/visited`) and `font.sans/mono/display`. A slot is **bound** when any mode authors or aliases it (a `bindings` rule included) and is then left alone. `neutral.solid` is never proposed: both examples that bind it call it a judgment in their README. `radius.md` is a literal in every example, not a token to point at.
- **Candidates.** The project's own `semantic.*` color and `fontFamily` tokens, resolved in every mode, minus catalog slots, role grids (built-in and archetyped) and tokens that alias a catalog slot (a loop). `option.*` tokens count on name evidence only and never above `low`: a palette value is everywhere (`option.color.white` equals most pages).
- **Name evidence** comes from a versioned table in core, `synonyms@1` (`packages/core/src/synonyms.js`), written into every suggestion so a table change is visible in review. A name is read by structure: its words are matched whole, and a family word (focus/ring, link, text, surface, border) decides before a role word can. So `text-primary` and `secondary-text` are text rungs, not roles (the false-friend rule), `focus-text` is in the focus family and is no text slot, and `link-primary` is `link.base`. A state word (`brand-hover`, `error-light`, `on-primary`) is never a `.solid`.
- **Value evidence** is the color's role shape in every mode: the page (`elevation.0.surface`) is low chroma at the end of the lightness range, level 1 its nearest low-chroma neighbour (either direction: every example authors light-mode level 1 darker than level 0), a border low chroma at 1.2–3:1 on the page, body text at 4.5:1. The remaining slots are measured against a **trial derivation**: DERIVE runs again with those first picks injected, and a candidate is close to what the slot would derive to (ΔE_OK ≤ 0.10 in every mode). A status color is matched on hue against its role's anchor (read off the catalog's `hue-anchor(n)` rule), within 10° in every mode at chroma ≥ 0.08, or within ΔE 0.10 of its derived value: hue first, because `danger`'s anchor takes its lightness from `primary`. A name is confirmed by the same measurements, with a 15° window for a status name, 3:1 on the page for a link, and "readable (3:1) but quieter than body text" for `text.muted`. `primary.solid` on value alone is the most chromatic candidate in the default mode. Value alone never proposes `info` (its anchor hue is where brand blues live), `secondary`, `accent`, `ring`, links or the other text rungs, and never a token whose name places it elsewhere (`govuk.focus` is the ring, not a warning).
- **Confidence** comes from agreement, never from a weighted sum, so every reason is a sentence: `high` when name and value agree, `medium` for one of them, `low` for `primary` on value alone (one mode decides it) and for an `option.*` token. **Contested**: the top two candidates have the same confidence and either both are name hits with different values, or the deciding measurement can't separate them (ΔE within 0.03, chroma within 0.015, contrast within 5 %, hue within 3°). Ties otherwise break on token path.
- **Output.** stdout is the alias token file, `$schema` first, each alias with a `$description` such as `suggested (high): name "brand" → primary.solid; chroma 0.14 in light · synonyms@1`. A contested slot is **not written**: it is listed in the file's root `$description` and on stderr with its candidates, because the importer contract ([clause 4](../plan/importer-contract.md)) says a contested binding is a question, not an answer. `--rules` prints the same proposals as `{ "bindings": [...] }` for `transtyle.config.json` ([binding rules](configuration.md#binding-rules)): proposals whose slot and token differ only by the same role, rung or level become one rule (`semantic.color.{role}.solid` ← `{semantic.color.ui.{role}}` with `roles` listing exactly the roles proposed), the rest literal rules; each generalized rule is kept only if expandBindings() gives back exactly its proposals, so the rules never bind more than the file. `--json` prints the whole report (`{ synonyms, rulePack, modes, defaultMode, slots, tokens, rules }`, each slot `bound`, `proposed`, `contested` or `none` with its ranked candidates). stderr gets the table either way.
- **Nothing is written.** Adding the file to `tokens` (or the rules to the config) is the review. A positional argument, `bind` without `--suggest`, or `--rules` with `--json` is a usage error (exit 2); a config or token file that can't be loaded exits 1 with its diagnostics. Other diagnostics are `check`'s business: a project being bound usually lacks `primary.solid` (TST1201), which is why it is being bound.

On the three examples that keep a bindings file, with that file removed from their config, the suggestion gives back every in-scope binding but one (Cathode binds `font.sans` to its mono stack on purpose) and proposes nothing they don't bind; `scripts/check-cli.mjs` asserts it, and the fixture `packages/core/test-fixtures/bind-suggest` covers the rules generalization and a contested slot. Measured per example in the [worklog](../worklog/2026-10-09-bind-suggest.md).

## `check --matrix` — who reads a slot

`explain` answers "where does this value come from"; `check --matrix` answers the reverse question an author asks before touching a slot: "if I author `elevation.3.surface`, which targets change?" ([issue #95](https://github.com/transtyle/transtyle/issues/95)).

Coverage rows can't answer it. A row's `slot` is a label for humans, often not a catalog path: ECharts names its palette as one range row (`semantic.palette.categorical.1–8`), Radix names its ramps with role wildcards (`semantic.color.primary.*`), Bootstrap answers most rows "via driven roots", PrimeNG has brace patterns. Matching those labels against catalog paths found 8 of the 82 slots Radix reads on Acme, and 54 of PrimeNG's 96. The structured `slots` and `via` fields `explain --target` reads (above) name what one variable reads, where an exporter fills them; they still don't cover a read no row describes (a Radix ramp step, a PrimeNG surface), so the matrix keeps recording.

So core records reads instead (`packages/core/src/reads.js`, [issue #160](https://github.com/transtyle/transtyle/issues/160); the CLI recorded them in its exporter loader until then). While an exporter's `emit()` runs, each resolved mode map it receives is a recording `Map` that notes every slot looked up with `get` or `has`, and every entry the exporter opens while iterating. Listing keys is not a read: css-variables walks every key and keeps the `semantic.*` ones, and only those it then reads count. The IR the exporter sees is unchanged (same keys, same entries, `modes.light` still the same object as its combo map), the exporter needs no change, and a third-party exporter gets it for free. `compile()` puts the result on each target result as `reads` (the catalog slots read, sorted; a lookup of a slot the design system doesn't resolve is not a read; a target that crashes reads nothing) and in its `report.json` ([report format](validation-and-coverage.md#report-format)).

`consumption(result)` from `@transtyle/core` turns a compile result into the matrix; the CLI only prints it. Each reader is classed from that target's coverage rows that name the slot exactly (in their `slots`, or as their `slot`), best first (`native`, `derived`, `approximated`). A read slot no row names is `input`: it feeds a value described under another slot or a pattern. This over-approximates in the safe direction: an exporter that reads a slot and discards it still counts as a reader, so an empty cell is a guarantee.

- Human output: one block per catalog section (each role of the grid, then the other semantic groups, then components), one line per slot with "read by n/N" and the readers.
- `--json`: each entry of the check report's `targets` carries its `reads` (with or without `--matrix`), and the report gains `matrix: { targets, slots }`, where `slots[slot][target] = { class, variables }` for each target that read it (`variables`: the coverage rows naming the slot) and `{}` for a slot nobody reads. Keys sorted; the output is deterministic.
- The docs page `website/src/docs/slot-matrix.md` is this matrix for Acme and every official exporter, generated by `scripts/gen-matrix.mjs` and guarded by `check:matrix`.
- Specced, not implemented: the downstream closure (authoring `elevation.3.surface` also changes `.4` and `.5`, which derive from it; the matrix shows direct readers only).

## `check --completeness` — what to author next

Beginners stop at `primary.solid`; mature teams can't tell when they are done. The completeness levels ([derivation.md](../architecture/derivation.md#completeness-levels), [issue #67](https://github.com/transtyle/transtyle/issues/67)) say which slots matter most to author, in the order they pay off. They are data in core (`packages/core/src/completeness.js`); `completenessStatus(normalized, level)` grades a compiled design system against one, and the CLI only formats the result.

- **Summary line.** `build` and `check` print `authored n/m <level>` once, before the per-target coverage bars (authoring doesn't depend on the target), on stderr. `n/m` counts items, not slots: a family such as `semantic.type.*` is one item, and each non-default `color-scheme` value adds one item per neutral. When something is left and no `--completeness` was given, the line ends with a pointer to the command. The level is `check.completeness` from the config, else `recommended`.
- **`check --completeness <level>`** (`minimal`, `recommended`, `complete`; anything else exits 2) overrides `check.completeness` for one run and prints the items still to author on stdout, numbered, each with its state (`missing`, `derived by <rule>`, `defaulted by <rule>`, `carried over from the default scheme`, or for a family `<state>, k/n authored`) and one line on why it matters. The exit code is unchanged: completeness is advice, and `derivation.require: ["completeness:<level>"]` is the policy knob that fails a build. `build --completeness` exits 2.
- **`--json`**: the check report always gains `completeness: { level, authored, total, todo }`, where each `todo` entry is `{ slot, state, mode?, rule?, reason, authoredMembers?, members? }`: `state` is `missing`, `derived`, `defaulted` or `carried-over`; `mode` is `color-scheme=<value>` on a per-scheme item; `rule` names the rule that filled a derived or defaulted slot as `catalog()` names it; `authoredMembers`/`members` are on a family. Items are in to-do order.
- `report.json` (build) does not carry it.

## Behavioral contracts

- **Exit codes:** 0 success; 1 diagnostics at/above the fail-on threshold; 2 usage/config errors. Stable, documented, CI-safe. An exporter that throws is not a usage error: it becomes a `TST3001` error diagnostic naming the target, the other targets still run so every crash is reported, nothing is written to disk (atomic EMIT), and the run exits 1 (`TST3002` for an exporter that cannot be loaded). `--verbose` (or `TRANSTYLE_DEBUG=1`) prints the stack under the message. `explain` without `--target` loads and runs no exporter, so a broken one cannot fail it.
- **Output streams:** human logs → stderr; requested data (`--json`, `explain`) → stdout. Pipeable by construction.
- **Non-interactive by default** when not a TTY; anything interactive has a flag equivalent. `init` is the only command that asks (above).
- **No telemetry.** If ever proposed, opt-in only, and it gets its own ADR and public schema.
- **`--out <dir>`** (`build` only): replaces every target's configured `output` with `<dir>/<instance name>`, including `report.json`; a relative `<dir>` is relative to the shell's directory, like `--cwd`. `compile({ outRoot })` applies it where the files are written and in `ctx.siblings[].output` and `ctx.targetConfig.output` (project-relative paths), so a Storybook target's imports of its siblings point inside `<dir>`. A missing value, or the flag on another command, exits 2. Why not "swap a leading `dist/`": configured outputs can be anything (`public/theme`, `packages/ui/src/tokens`), so only a fixed layout is predictable and collision-free.
- **`--dry-run`** (`build` only): the same code path as `build` with the commit left out (`compile({ dryRun: true })`: EMIT stages the files and stops). It prints the coverage and, per target, the files it _would_ write with `report.json`, ends with `✔ dry run complete, nothing written`, leaves the disk untouched and exits like `build` (1 on a diagnostic at or above `check.failOn`). `results[].planned` (`{ path, bytes }`) is the same list for programmatic callers; `files` stays what was actually written.
- **`--quiet`** (`build`, `check`): stderr keeps errors, warnings when `check.failOn` is `warning` (they fail the run), and the `✖ failed` line; coverage lines, file list, other diagnostics and the success line are dropped. stdout data (`check --json`, `--matrix`) and exit codes never change.
- **`--verbose`** (`build`, `check`): adds per target the exporter, its options, the output directory, row counts, and each file's size in bytes, and prints the stack of a crashed exporter (`TST3001`/`TST3002`) or of a fatal error. `TRANSTYLE_DEBUG=1` is the same switch. `--quiet` with `--verbose` exits 2.
- **`--quiet`, `--verbose`, `--out`, `--dry-run` on a command that does not take them exit 2**, like an unknown flag: `explain`, `diff`, `catalog` and `bindings` print the answer, so there is nothing to turn down.
- **`NO_COLOR`:** the CLI emits no ANSI escape anywhere (`✖ ⚠ ℹ` are plain Unicode), so there is nothing to switch off; it is honored by contract (no-color.org: set and non-empty). The only color is `init`'s truecolor chip, shown on a terminal when `NO_COLOR` is unset. `scripts/check-cli.mjs` pins "no ESC byte" with and without the variable.

## Programmatic parity

The goal is that every command that computes something be a thin wrapper over `@transtyle/core`'s public API, so the CLI never holds logic a build-tool integration cannot reach. `build` and `check` are `compile({ emit })`, `diff` is `compile()` twice plus `diffResolved()`/`contrastRegressions()`, `catalog` is `catalog()`, `check --completeness` is `completenessStatus(normalized, level)`, `bind --suggest` is `suggestBindings({ cwd })` (the report the CLI prints, `--json` verbatim), `check --matrix` is `compile({ emit: false })` plus `consumption(result)`, `migrate --from style-dictionary` is `migrateStyleDictionary()` over the files `expandTokenFiles()` finds, and `explain` is `compile({ emit: false })` plus `explainToken(normalized, slot, { mode })`, which returns the provenance walk as a JSON-serialisable tree (`{ slot, mode, entry, inputs }`, an aliased entry's one input being its alias target, with `seen`, `unresolved` and `truncated` markers) and throws an `Error` with a `code` of `unknown-mode` (`available`) or `unknown-slot` (`closest`); the CLI only formats the tree. `explain --target` adds `slotConsumers(result, target, slot)` and `explain --variable` is `explainVariable(result, target, variable)` (both over `compile()`'s result; errors `unknown-target` with `available`, `unknown-variable` with `closest`), with `coverageSlots(row, normalized)` as the rule for what a row reads; whether the target read the slot at all comes from its `reads`. `init` and `add` are **CLI-only on purpose**: they scaffold files and rewrite the config, and `add` validates against the CLI's own list of official exporters, which core deliberately does not know.
