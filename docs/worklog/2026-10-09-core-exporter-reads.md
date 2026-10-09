# Exporter reads recorded by core

Issue [#160](https://github.com/transtyle/transtyle/issues/160), the follow-up
of the slot matrix ([#95](https://github.com/transtyle/transtyle/issues/95),
[worklog](2026-10-09-slot-matrix.md)). The matrix recorded what each exporter
reads from the CLI's exporter loader, so only `check --matrix` saw it: no
`reads` in `report.json`, no `consumption()` for other tools. This closes the
deviation that worklog recorded.

## What was done

- `packages/core/src/reads.js`: the `RecordingMap` moved from
  `packages/cli/src/matrix.js` unchanged. `compile()` hands each exporter
  `recordingView(view)` instead of the view itself (the full IR or the target's
  mode subset), and puts the sorted catalog slots it read on the target result
  as `reads`. A lookup of a slot the view doesn't hold is dropped (the CLI's
  `consumption()` already filtered those out); a target that fails to load or
  crashes in `emit` gets `reads: []`, like its empty coverage.
- `report.json` gains `reads` between `coverage` and `diagnostics`.
  `report.schema.js` declares it optional (a report written before it still
  validates), items restricted to `semantic.*` / `component.*`;
  `npm run gen:schemas` regenerated `website/public/schemas/report/v0.json`.
- `consumption(result)` is exported from `@transtyle/core` and reads each
  result's `reads`; the second `readSets` argument is gone with the loader.
  `packages/cli/src/matrix.js` keeps only the rendering (`sectionOf`,
  `sections`, `renderMatrix`). `check --matrix` and `scripts/gen-matrix.mjs`
  call core's `consumption()` (which keeps `coverageSlots()` for classing, as
  the CLI's did since #98); `explain <slot> --target` reads the target's
  `reads` instead of wrapping the loader; `check --json` lists `reads` per target.
- `check-cli`: the old "recording changes no coverage row" case became "the
  per-target report is the same with and without `--matrix`", plus `reads` on
  `check --json` (sorted, catalog only), the matrix agreeing with `reads` cell
  for cell, `report.json` carrying the same `reads` after a build, `reads: []`
  for the crashed and unloadable targets, and four cases on the recording view
  itself (same keys, alias identity, listing keys is not a read, a missing slot
  is not a read). Breaking the report field on purpose turns the report case red.
- Surfaces: `docs/specs/cli.md` (`check --matrix`, programmatic parity),
  `docs/specs/validation-and-coverage.md` (report format),
  `docs/architecture/pipeline.md` and `plugins.md`, the website's CLI,
  write-an-exporter, AI agents and roadmap pages, `ROADMAP.md`, the core
  README, `scripts/README.md`.

## Measured

- Read counts on Acme are those of the slot-matrix worklog: shadcn 23,
  ECharts 15, daisyUI 21, Bootstrap 94, Storybook 16, css-variables 251,
  Radix 82, PrimeNG 96, Mantine 154; Chakra and MUI, which landed since, 165 and 193. `check:matrix` passes against the page as
  committed (255 slots × 9 targets).
- Every example compiled before and after the change gives the same emitted
  files and the same coverage rows, byte for byte, on all 45 target instances.
- Recording is always on. Compiling the four examples took 44–60 ms per round
  both ways over 10 rounds: the cost is inside the run-to-run noise, so it
  was not made opt-in.

## Not done

- The downstream closure (authoring `elevation.3.surface` also changes `.4` and
  `.5`): still specced in `docs/specs/cli.md`.
