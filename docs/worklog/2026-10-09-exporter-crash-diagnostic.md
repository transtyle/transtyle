# An exporter that throws now names its target

Issue [#28](https://github.com/transtyle/transtyle/issues/28). A throw inside an
exporter reached the CLI as a bare `✖ Cannot read properties of undefined`, with
no target, no stack and exit 2, and it stopped every later target.

## What changed

- `compile()` wraps `exporter.emit` (only that call, so a write error is not
  taken for an exporter bug) and records `TST3001`: `Exporter "<instance>"
crashed in <stage>: <message>`. A load failure is `TST3002`, same treatment.
- The loop's "never emit with errors present" guards now count pipeline errors
  only. A crash is recorded per target and the next target still runs.
- The crashed target is still in `results` with empty coverage and no files.
  (Superseded by [atomic EMIT](2026-10-09-atomic-emit.md): a build with any
  error writes nothing, so no `report.json` is written for it either.)
- The crash exits 1, not 2: it is a build failure that `check.failOn` governs
  like any other error (the exit-code answer given on the issue).
- `compile({ skipExporters: true })` stops after the shared stages; `explain`
  uses it, so it cannot fail on an exporter at all. `diff` keeps running them,
  it needs the emitted files.
- Stack: `compile({ debug: true })` keeps it on the diagnostic; the CLI sets it
  from `TRANSTYLE_DEBUG`. Off by default so output and reports stay free of
  machine paths. `--verbose` (#5) is still not implemented and will replace the
  variable.

## Deviations

None from a plan; the issue's own approach, with the exit code and plugin load
failures settled as recommended on the issue.
