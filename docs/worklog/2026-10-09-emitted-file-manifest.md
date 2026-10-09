# Emitted-file manifest and drift detection

Issue [#10](https://github.com/transtyle/transtyle/issues/10).
[validation-and-coverage.md](../specs/validation-and-coverage.md) specced "emitted-file
hashes against a `transtyle-manifest.json`, so a hand-edited generated file warns", and
[pipeline.md §5](../architecture/pipeline.md#5-emit) the manifest "for orphan cleanup and
drift detection". Every generated file asked not to be edited and nothing checked it: an
edit survived until the next build silently threw it away.

## What changed

- `packages/core/src/manifest.js` (new). Each build adds `transtyle-manifest.json` to every
  target's plan, after `report.json`, so [atomic EMIT](2026-10-09-atomic-emit.md) stages and
  swaps it with the files it describes: a failed build leaves the previous manifest next to
  the previous files, and a manifest never lists a file that did not land.
  `{ $schema, target, algorithm: "sha256", files: { "<path>": "<hex>" } }`, keys sorted, no
  timestamp or version, so `check:determinism` covers it unchanged.
- `compile({ drift: true })` reads each selected target's manifest before the target loop and
  warns `TST1312` per listed file that changed or is gone, and per manifest that is not valid
  JSON or not of the right shape. The CLI passes it for `build` and `check` only.
- `build` lists the files the previous manifest had and this build does not produce as
  `· stale: …` under their target, and leaves them in place: the `stale` summary the atomic
  EMIT entry deferred to this issue.
- `packages/core/src/schema/manifest.schema.js`, published by `gen:schemas` at
  `schemas/manifest/v0.json`; core validates a manifest against it before trusting it, and
  `check:schemas` validates the 41 manifests the examples emit and checks that each lists
  exactly the files of its `report.json`.
- `check:cli`: 24 golden cases (clean, CRLF, edit, `failOn: warning`, `--json`, `explain`
  and `diff` silent, build warns then overwrites, missing file, broken manifest, no
  manifest, filtered build, stale, `--dry-run`, `--out`). `check:atomic-emit`: the manifest is swapped with its
  files and rolled back with them.

## Choices

- **Per target, in the output directory.** A filtered build (`build shadcn`) rewrites only
  its own manifest; one project-level file would need merging on every filtered build. Keys
  are relative to the output directory, and `build --out <dir>` (#5) reads and writes the
  manifest in `<dir>/<target>`, so it moves with the output. `build --dry-run` reports drift
  and stale files and writes nothing.
- **The exporter's files only.** `report.json` changes with the diagnostics of the run and
  nobody consumes it as a theme; the manifest can't hash itself.
- **LF before hashing.** A `core.autocrlf` checkout of committed output would otherwise be
  reported file by file. The cost, an edit that only changes line endings goes unreported,
  is accepted.
- **Warn and overwrite in `build`.** The warning appears when the edit is lost (it is still
  in version control when the output is committed). Refusing to overwrite would block the
  "edit to try something, rebuild" loop and need an override flag.
- **Off by default in `compile()`.** `explain`, `diff`, the website and the scripts call
  `compile()` too and must not start reporting on whatever `dist/` sits next to a project.
  Drift runs before suppressions are applied, so `check.suppress` can silence `TST1312`.
- **One code, `TST1312`**, for edited, missing and unreadable: one fix (rebuild) and one
  severity (`check-docs` requires a single severity per code). `13xx` sits with the file-level
  codes; `TST1309` and `TST1310` went to the exporter compatibility check (#14), `TST1311`
  to malformed token metadata (#30).
- **A manifest naming another instance is ignored**, as if absent: two instances sharing an
  output directory, or an instance renamed in the config. Better silent than a warning per
  file for a directory this instance never wrote.
- **Stale files are listed once.** The new manifest lists only what this build wrote, so the
  next build no longer knows about them. Carrying them forward would repeat the line on every
  build with no way to silence it short of deleting the file; orphan cleanup (still
  specced) is where a durable list belongs.

## Not done here

- Output out of date with the tokens (the file matches its manifest but a fresh compile
  differs, "forgot to rebuild"): `check` has the fresh files in memory and could report it
  with a second code.
- Orphan cleanup, reserved exporter file names (`report.json`, `transtyle-manifest.json`),
  and toolchain versions (#1).
