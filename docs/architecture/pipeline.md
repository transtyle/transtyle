# Compilation pipeline

> **Status (re-verified 2026-08-29):** the six stages, their order, the shared
> diagnostics collector, provenance recording, coverage classification and the
> `check` = pipeline-minus-EMIT identity are **implemented**. Marked inline
> below: per-token source maps, core-evaluated mapping tables, target-version
> compat ranges, and the emitted-file manifest — all still specced, and all
> previously written here in the present tense. Atomic staged writes and the
> emitted-file manifest (drift detection) landed after this check and are now
> **implemented** (§5), and so is in-memory compilation: LOAD's reading half is
> split from the rest (§1), so the pipeline runs on a project held in memory and
> returns its files unwritten (§5). Orphan cleanup is still specced.

Six stages. Each stage has a single responsibility, a typed input/output, and emits diagnostics into a shared collector rather than throwing (all recoverable problems are gathered so users see everything in one run; only unrecoverable states abort).

## 1. LOAD

Discover and parse inputs: `transtyle.config.*`, token files it references, and any importer-provided sources.

- Config discovery follows the cosmiconfig-style convention ([specs/configuration.md](../specs/configuration.md)).
- The config is `transtyle.config.json` in `--cwd`, or the file `--config` names. It may `extends` a base: LOAD follows the chain to its root, validates each file on its own (so `TST1010` names the file), then merges them, the nearer file winning, and rewrites every token glob relative to the project directory, the leaf config's directory ([ADR-0016](../adr/0016-config-inheritance.md), [specs/configuration.md](../specs/configuration.md#inheritance-extends)). Everything after LOAD sees one merged config; the chain itself survives only as `config` in `report.json` and `check --json`.
- Token files are parsed as DTCG JSON. Importers (Tailwind config, Figma export…) run here and must output _the same raw DTCG-superset structure_ as if the user had authored files — importers get no private path into the IR. This keeps `import` explainable: you can materialize what an importer produced (`transtyle import --write`) and inspect it.
- **Reading is the only part that needs a disk.** `loadProject(cwd)` reads the config (its `extends` chain followed and merged) and the text of every file its `tokens` globs match into an in-memory project: `{ config, files }`, `files` mapping each token file's POSIX path (relative to the project directory) to its contents. The chain is the disk's: a host without a disk passes one merged config. Everything else in LOAD runs on that project, in `compileProject()`: the config schema check (`TST1010`; `compile()` runs it on each file of a chain first, so the code names the file), expanding `tokens` against the map's keys (a `*` matches a directory in the middle of a pattern and a file at its end), parsing (`TST1002`, with the line when the contents are text; an already-parsed object is used as is and carries no line) and the per-file structural checks below. A host without a disk (a browser playground, an editor, a test) passes its own `{ config, files }` and gets the same layers and the same diagnostics, naming the same files.
- Each file is loaded once. A file matched by a mode-scoped entry is that mode's overlay only: plain globs skip it, whatever the order of the entries ([ADR-0009](../adr/0009-token-layering.md#amendment-2026-10-08-an-overlay-claims-its-file)).
- A Tokens Studio export (`{ "tokensStudio": … }`) is read in place, not through an importer ([ADR-0014](../adr/0014-tokens-studio-input.md)): its sets, set order and themes are read, its dialect converted (types, units, weights, legacy keys), each set placed under a tier with its references rewritten, and the themes lowered to a base layer plus one mode-scoped layer per non-default mode value — the trees a hand-written layout would give. Math and references inside a string are kept as expressions for NORMALIZE ([configuration.md](../specs/configuration.md#tokens-studio-exports)).
- Output: raw token forest + config object. Each tree remembers the file it came from and the mode layer it was scoped to; **specced:** per-token file/line source maps, and surfacing either in a diagnostic (today a message names the token path, not its location).

## 2. NORMALIZE

Turn the raw forest into canonical IR:

- validate the DTCG structure per file at LOAD (unrecognized `$type` `TST1306`, a `$type` with no value `TST1302`, a top-level group that isn't a tier `TST1305`, a Style Dictionary v3 file with `value`/`type` and no `$value` `TST1307`, which `transtyle migrate --from style-dictionary` rewrites) and reject malformed values here (`TST1106`);
- resolve `$ref`/alias chains (`{color.brand.500}`), detecting cycles;
- evaluate a Tokens Studio expression (`{option.space.base} * 2`, `rgba({option.color.black}, 0.5)`) once its references have resolved for the mode at hand, so the result is per mode; a plain DTCG string is never evaluated. Provenance stays `authored` and records the expression, and a token of an export carries its `source` (set file, set, Tokens Studio path);
- expand mode definitions into the mode matrix ([ir.md](ir.md#modes));
- canonicalize colors to OKLCH internally (CSS strings and DTCG color objects alike, any of the fourteen DTCG color spaces), keeping the authored text alongside for provenance and for exporters that want it back in its original form. Dimension **units** are not converted — `0.5rem` stays `0.5rem` all the way to the target, and unit conversion happens in the exporter that needs it (which is why `rem → px` shows up as an `approximated` row on ECharts rather than as a normalization step). What NORMALIZE does canonicalize is the DTCG structured form of `dimension`, `duration`, `cubicBezier` and `fontWeight` (also as composite members): `{ "value": 0.5, "unit": "rem" }` becomes the string `0.5rem`, `[0.2, 0, 0, 1]` becomes `cubic-bezier(0.2, 0, 0, 1)`, `"semi-bold"` becomes `600`, so exporters only ever see the CSS form and both authoring forms compile to the same bytes ([ir.md](ir.md#values-and-canonicalization));
- parse DTCG composites (`shadow`, `typography`, `border`, `transition`) member by member, by each member's DTCG type: a color member canonicalizes like a color token, a dimension, duration, cubicBezier or fontWeight member like a token of that type (so its structured form becomes the CSS string too), a member alias resolves per mode (deferred past DERIVE when it names a derived slot, like a top-level alias), a missing required member or a malformed one is `TST1106` under the member's path (`….shadow.color`, `….shadow.1.color` for a stacked shadow's second layer). Member aliases are kept in provenance (`members`) for `explain`;
- flatten group-level `$type` inheritance.

Output: **authored IR** — complete graph of what the user actually said, with provenance `authored` or `aliased`.

## 3. DERIVE

Fill what the user didn't say, using the deterministic rule system ([derivation.md](derivation.md)). Rules run in a **fixed catalog order**, not to a fixpoint: the order is what guarantees a rule's inputs are already resolved when it runs, which is cheaper than iterating and makes the trace in `explain` a straight line rather than a settling process. Every derived token records `derived(rule, inputs)` provenance.

Output: **complete IR** — the semantic surface exporters may rely on is now total: every required semantic slot has a value, every value knows its origin.

## 4. RESOLVE

Per target. The exporter's mapping runs against the IR — the complete one, or, when the target sets `modes`, a view of it restricted to the kept combos (derivation and checks have already run once on the full matrix; no exporter needs to know the option exists, see [configuration.md](../specs/configuration.md#per-target-mode-subsets)):

- the exporter owns its mapping table and applies it in its own `emit` — an earlier draft had core evaluating declarative tables through a `resolve`/`emit` split, and [plugins.md](plugins.md) records why that was dropped: eight exporters were written against the single-hook interface and none needed it. A [declarative mapping](../specs/declarative-mapping.md) is an exporter in its own right, run by core's declarative runtime behind the same hook, not a table core evaluates for another exporter ([ADR-0017](../adr/0017-declarative-exporters.md));
- programmatic resolution handles what a table can't express (ECharts' categorical palette, PrimeNG's severity grid);
- version selection: a target's requested framework version (`targets.<t>.version`) is matched against the exporter manifest's ranges and the covering profile reaches `emit` as `ctx.targetProfile`; a version outside every range is `TST1313` ([versioning.md](versioning.md#target-framework-versions-adr-0006));
- each mapping decision is classified for the coverage report: `native | derived | approximated | dropped | unsupported`;
- an exporter may also return `info`/`warning` diagnostics about what its target's own conventions do to an authored value (shadcn's radius rungs, `TST2104`); core validates them and adds them to the shared collector under the target instance's name ([plugins.md](plugins.md#the-exporter-interface-v0-as-implemented)).
- core records which catalog slots the exporter reads while it runs: the mode maps it is handed note every `get`/`has` and every entry opened while iterating, with the same keys and values as the IR. The sorted list is the target's `reads`, in its `report.json`, and what `check --matrix` is built from ([cli.md](../specs/cli.md#check---matrix--who-reads-a-slot)). No exporter declares or changes anything for it.

Output: per-target **resolution** — a pure data structure, still no files.

## 5. EMIT

Exporters transform their resolution into file descriptions `{ path, contents, kind }`. `compileProject()` returns them per target, with that target's `report.json` (§6) appended, and writes nothing; `writeResults()` commits a run with no errors to disk. Core (never plugins) writes them:

- atomic staging and swap, so a failed build leaves no half-written output. Every exporter runs before anything is written; then each file is staged in `<output>.transtyle-tmp/` next to its output directory and renamed onto its destination, a file it replaces being parked in `<output>.transtyle-bak/` first. If any step fails, the swap is undone (replaced files come back, new files and new directories go) and the exception propagates, so every output directory is exactly what it was before the build. Both staging directories are removed on success and on failure, and have fixed names, so one left by a killed process is cleared by the next build. No file is written at all if any `error`-level diagnostic was raised, in any target. The swap is per file, not per directory, because files in an output directory that this build did not produce are never touched (orphan cleanup, which the manifest below makes possible, is still specced); a rename that the platform refuses (Windows, cross-device) falls back to copy and delete. A hard kill in the middle of the swap itself can still leave a mixed directory, and the next build's overwrite repairs it; the guarantee covers errors, not power loss. A file the previous manifest lists that this build does not produce is listed once in the build summary as `stale` and left in place;
- every generated file gets a marker header (`GENERATED by transtyle — do not edit; source: tokens/…`) where the format allows comments;
- a `transtyle-manifest.json` per target: the sha256 of each file the exporter produced (text with CRLF normalized to LF), keys sorted, no timestamp, staged and swapped with the files it describes so it never lists a file that did not land. Before the target loop, `build` and `check` compare each selected target's manifest with the disk and warn `TST1312` for a file changed or removed outside transtyle (drift detection, [validation-and-coverage.md](../specs/validation-and-coverage.md#built-in-checks-phase-1)); a build warns, then overwrites. Both are the disk side's (`compile()`), since they describe an output directory: `compileProject()` returns no manifest, `compile()` adds it to each target's files before `writeResults()`, and passes the drift warnings in so they land in the same place in every `report.json` and `check.suppress` applies to them. **Specced:** orphan cleanup (deleting the `stale` files above), which is a decision of its own;
- deterministic serialization: stable key order, fixed number formatting, LF endings, trailing-newline policy — byte-identical rebuilds are a tested guarantee.

## 6. REPORT

Aggregate diagnostics + coverage into the build report: human rendering (terminal) and `report.json` (CI). Non-zero exit codes are policy-driven (`check.failOn: error | warning | approximation`) so teams choose their strictness.

## Cross-cutting design points

- **`check` = pipeline minus EMIT.** Same code path, so validation can never drift from real builds.
- **`explain` reads provenance recorded by stages 2–4;** it is a query over build output, not a separate analysis (cannot lie).
- **Concurrency:** stages 1–3 are shared per build; stage 4–5 run per-target, parallelizable and independent by construction.
- **Error philosophy:** a build never half-succeeds. The target loop stops at the first `error`-level diagnostic and nothing is emitted for any target — deliberately stricter than the "carry on with the others" this line used to describe, because a partial set of theme files is harder to reason about than none. Diagnostics from every stage before that point are still reported together.
