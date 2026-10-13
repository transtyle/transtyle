# Output out of date with the tokens (TST1315)

Follow-up of [the emitted-file manifest](2026-10-09-emitted-file-manifest.md) (issue
[#10](https://github.com/transtyle/transtyle/issues/10)), which listed "output out of date with
the tokens" under "Not done here". The manifest tells a hand edit from the exporter's own bytes;
`check` has the fresh files in memory, so it can also tell "forgot to rebuild".

## What changed

- `reportOutOfDate()` in `packages/core/src/manifest.js`: for each target with a usable manifest,
  a file the manifest lists whose disk hash equals the manifest hash but differs from the hash of
  the fresh file raises `TST1315` (warning), once per target, naming up to three files and the
  count of the rest.
- `compileProject()` takes a second hook, `checkEmitted(results)`, called after the last exporter
  and before `check.suppress`; `compile()` passes one when `drift` is set and `emit` is not, so
  `check.suppress` and `check.failOn` apply and the diagnostic keeps its `target`.
- Docs: the drift bullet in `validation-and-coverage.md`, `pipeline.md` §5, the `cli.md` spec
  status, the website's CLI "Drift detection" section and a `diagnostics.md` row. `check:cli`:
  10 golden cases (clean, changed tokens, `--json`, `failOn`, `suppress`, `explain`, hand edit,
  build, rebuild, no manifest).

## Choices

- **`check` only, not `build`.** The goal said "only under `drift: true`", which `build` also
  passes. A build overwrites the files straight away, so the warning would be printed on every
  build that follows a token change, saying what the build is doing. Keyed on `drift && !emit`.
  The alternative (also on `build`) is a one-line change.
- **A file `TST1312` reported is left out**, since its disk bytes differ from the manifest and
  the edit is the first thing to deal with. A file whose disk bytes were edited back to match the
  fresh compile is neither.
- **One warning per target**, with the first three files named, because a token change usually
  makes most of a target's files stale at once.
- **`TST1315`, not `TST1313`.** Open PR #213 takes `TST1313`; `TST1310` in the original goal is the
  plugin-manifest warning, the drift code on main is `TST1312`.
