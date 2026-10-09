# Compilation pipeline

> **Status (re-verified 2026-08-29):** the six stages, their order, the shared
> diagnostics collector, provenance recording, coverage classification and the
> `check` = pipeline-minus-EMIT identity are **implemented**. Marked inline
> below: per-token source maps, core-evaluated mapping tables, target-version
> compat ranges, and the emitted-file manifest — all still specced, and all
> previously written here in the present tense. Atomic staged writes landed
> after this check and are now **implemented** (§5).

Six stages. Each stage has a single responsibility, a typed input/output, and emits diagnostics into a shared collector rather than throwing (all recoverable problems are gathered so users see everything in one run; only unrecoverable states abort).

## 1. LOAD

Discover and parse inputs: `transtyle.config.*`, token files it references, and any importer-provided sources.

- Config discovery follows the cosmiconfig-style convention ([specs/configuration.md](../specs/configuration.md)).
- Token files are parsed as DTCG JSON. Importers (Tailwind config, Figma export…) run here and must output _the same raw DTCG-superset structure_ as if the user had authored files — importers get no private path into the IR. This keeps `import` explainable: you can materialize what an importer produced (`transtyle import --write`) and inspect it.
- Each file is loaded once. A file matched by a mode-scoped entry is that mode's overlay only: plain globs skip it, whatever the order of the entries ([ADR-0009](../adr/0009-token-layering.md#amendment-2026-10-08-an-overlay-claims-its-file)).
- Output: raw token forest + config object. Each tree remembers the file it came from and the mode layer it was scoped to; **specced:** per-token file/line source maps, and surfacing either in a diagnostic (today a message names the token path, not its location).

## 2. NORMALIZE

Turn the raw forest into canonical IR:

- validate the DTCG structure per file at LOAD (unrecognized `$type` `TST1306`, a `$type` with no value `TST1302`, a top-level group that isn't a tier `TST1305`, a Style Dictionary v3 file with `value`/`type` and no `$value` `TST1307`) and reject malformed values here (`TST1106`);
- resolve `$ref`/alias chains (`{color.brand.500}`), detecting cycles;
- expand mode definitions into the mode matrix ([ir.md](ir.md#modes));
- canonicalize colors to OKLCH internally, keeping the authored text alongside for provenance and for exporters that want it back in its original form. Dimension **units** are not converted — `0.5rem` stays `0.5rem` all the way to the target, and unit conversion happens in the exporter that needs it (which is why `rem → px` shows up as an `approximated` row on ECharts rather than as a normalization step). What NORMALIZE does canonicalize is the DTCG structured form of `dimension`, `duration`, `cubicBezier` and `fontWeight` (also as composite members): `{ "value": 0.5, "unit": "rem" }` becomes the string `0.5rem`, `[0.2, 0, 0, 1]` becomes `cubic-bezier(0.2, 0, 0, 1)`, `"semi-bold"` becomes `600`, so exporters only ever see the CSS form and both authoring forms compile to the same bytes ([ir.md](ir.md#values-and-canonicalization));
- parse DTCG composites (`shadow`, `typography`, `border`, `transition`) member by member, by each member's DTCG type: a color member canonicalizes like a color token, a dimension, duration, cubicBezier or fontWeight member like a token of that type (so its structured form becomes the CSS string too), a member alias resolves per mode (deferred past DERIVE when it names a derived slot, like a top-level alias), a missing required member or a malformed one is `TST1106` under the member's path (`….shadow.color`, `….shadow.1.color` for a stacked shadow's second layer). Member aliases are kept in provenance (`members`) for `explain`;
- flatten group-level `$type` inheritance.

Output: **authored IR** — complete graph of what the user actually said, with provenance `authored` or `aliased`.

## 3. DERIVE

Fill what the user didn't say, using the deterministic rule system ([derivation.md](derivation.md)). Rules run in a **fixed catalog order**, not to a fixpoint: the order is what guarantees a rule's inputs are already resolved when it runs, which is cheaper than iterating and makes the trace in `explain` a straight line rather than a settling process. Every derived token records `derived(rule, inputs)` provenance.

Output: **complete IR** — the semantic surface exporters may rely on is now total: every required semantic slot has a value, every value knows its origin.

## 4. RESOLVE

Per target. The exporter's mapping runs against the IR — the complete one, or, when the target sets `modes`, a view of it restricted to the kept combos (derivation and checks have already run once on the full matrix; no exporter needs to know the option exists, see [configuration.md](../specs/configuration.md#per-target-mode-subsets)):

- the exporter owns its mapping table and applies it in its own `emit` — an earlier draft had core evaluating declarative tables through a `resolve`/`emit` split, and [plugins.md](plugins.md) records why that was dropped: eight exporters were written against the single-hook interface and none needed it;
- programmatic resolution handles what a table can't express (ECharts' categorical palette, PrimeNG's severity grid);
- **specced:** version selection against the exporter's compat ranges ([versioning.md](versioning.md)). Today a target era is an explicit option (shadcn's `tailwind-v3`/`v4`, daisyUI's `v5`), not a range match;
- each mapping decision is classified for the coverage report: `native | derived | approximated | dropped | unsupported`.

Output: per-target **resolution** — a pure data structure, still no files.

## 5. EMIT

Exporters transform their resolution into file descriptions `{ path, contents, kind }`. Core (never plugins) writes them:

- atomic staging and swap, so a failed build leaves no half-written output. Every exporter runs before anything is written; then each file is staged in `<output>.transtyle-tmp/` next to its output directory and renamed onto its destination, a file it replaces being parked in `<output>.transtyle-bak/` first. If any step fails, the swap is undone (replaced files come back, new files and new directories go) and the exception propagates, so every output directory is exactly what it was before the build. Both staging directories are removed on success and on failure, and have fixed names, so one left by a killed process is cleared by the next build. No file is written at all if any `error`-level diagnostic was raised, in any target. The swap is per file, not per directory, because files in an output directory that this build did not produce are never touched (orphan cleanup needs the manifest below); a rename that the platform refuses (Windows, cross-device) falls back to copy and delete. A hard kill in the middle of the swap itself can still leave a mixed directory, and the next build's overwrite repairs it; the guarantee covers errors, not power loss. The `stale` listing of files from earlier builds that this one did not produce waits on the manifest;
- every generated file gets a marker header (`GENERATED by transtyle — do not edit; source: tokens/…`) where the format allows comments;
- **specced:** a `transtyle-manifest.json` of emitted files and content hashes, for orphan cleanup and drift detection. Nothing writes one today; `report.json` lists the files a build produced, and the marker header is the only thing telling a reader not to edit them;
- deterministic serialization: stable key order, fixed number formatting, LF endings, trailing-newline policy — byte-identical rebuilds are a tested guarantee.

## 6. REPORT

Aggregate diagnostics + coverage into the build report: human rendering (terminal) and `report.json` (CI). Non-zero exit codes are policy-driven (`check.failOn: error | warning | approximation`) so teams choose their strictness.

## Cross-cutting design points

- **`check` = pipeline minus EMIT.** Same code path, so validation can never drift from real builds.
- **`explain` reads provenance recorded by stages 2–4;** it is a query over build output, not a separate analysis (cannot lie).
- **Concurrency:** stages 1–3 are shared per build; stage 4–5 run per-target, parallelizable and independent by construction.
- **Error philosophy:** a build never half-succeeds. The target loop stops at the first `error`-level diagnostic and nothing is emitted for any target — deliberately stricter than the "carry on with the others" this line used to describe, because a partial set of theme files is harder to reason about than none. Diagnostics from every stage before that point are still reported together.
