# The slot × target matrix

Issue [#95](https://github.com/transtyle/transtyle/issues/95): which targets
read each catalog slot, so an author knows what authoring one changes. Built on
the refinement appended to the issue (record what exporters read, don't parse
coverage labels) and its follow-up decision (`transtyle check --matrix` now,
rather than waiting for `transtyle catalog`, #65).

## What was done

- `packages/cli/src/matrix.js`: while an exporter's `emit()` runs, each resolved
  mode map it receives is a `RecordingMap` (a `Map` subclass holding the same
  entries) that notes every `get` and `has`, and every entry the exporter opens
  while iterating. Listing keys is not a read, so css-variables, which walks
  every key and keeps the `semantic.*` ones, is not recorded as reading
  `component.*` or `option.*`. Aliased mode maps (`modes.light` is a combo map)
  keep sharing one object. `consumption()` builds `{ targets, slots }`, each
  reader classed from the coverage rows naming the slot exactly (best of
  native, derived, approximated), else `input`.
- `transtyle check --matrix [--json]`: the human table on stdout, grouped by
  catalog section; with `--json` a `matrix` key on the existing report.
  `build --matrix` is a usage error.
- `scripts/gen-matrix.mjs` writes `website/src/docs/slot-matrix.md` (Acme, one
  instance per official exporter, rows = the slots all four examples share),
  formatted with the repo's prettier config; `check:matrix` (in `check:all`)
  regenerates it in memory and fails on any difference.
- `check-cli` covers both outputs on Acme, including the issue's acceptance
  cases, and that recording leaves every coverage row unchanged.

## Measured

- On Acme, with recorded reads: shadcn 23 slots, ECharts 15, daisyUI 21,
  Bootstrap 94, Storybook 16, css-variables 251, Radix 82, PrimeNG 96, Mantine 154. Same as the refinement's probe for the first eight, except css-variables
  (250 then, one slot added to the catalog since); Mantine landed after it.
- `palette.categorical.1` is read by shadcn, ECharts and css-variables;
  `elevation.3.surface` by shadcn, ECharts, css-variables and PrimeNG (the
  refinement's corrected acceptance). One slot, `elevation.0.surface`, is read by
  all nine targets; 71 only by css-variables; every slot by at least one target.
- Recording changes no output: every example compiled with and without it gives
  the same emitted files and coverage, byte for byte.

## Deviations from the refinement

- **Reads are recorded in the CLI, not in core.** The refinement put the wrapper
  in `packages/core/src/index.js` with a `reads` field in each `report.json`.
  Several core changes were landing at the same time, and `compile()` already
  takes the exporter loader as a parameter, so the CLI wraps the exporters it
  loads instead: the same read sets, no core change. Not done as a result:
  `reads` in `report.json` and its schema, and a `consumption()` export from
  core. Both are a small move of `matrix.js` into core when wanted; the CLI spec
  lists them as specced.
- **ECharts' palette cells read `input`.** Its coverage names the palette in one
  range row (`categorical.1–8`), so no row names `categorical.1` exactly.
  Splitting that row into eight (refinement item 4, optional) changes the
  exporter and its documented row count; left for a follow-up.
- **`language.md`** links each slot table to its section of the matrix page
  rather than embedding cells, as the refinement proposed.
