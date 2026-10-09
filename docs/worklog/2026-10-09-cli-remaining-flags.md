# The remaining CLI flags: --out, --dry-run, --quiet, --verbose, NO_COLOR

Issue [#5](https://github.com/transtyle/transtyle/issues/5). `docs/specs/cli.md`
listed these as specced but unread, and an unknown flag exits 2, so following
the docs failed.

## What changed

- `compile()` takes `outRoot` (an absolute directory: target `<name>` goes to
  `<outRoot>/<name>`) and `dryRun`. `outRoot` is applied to the write directory
  and to `ctx.siblings[].output` / `ctx.targetConfig.output`, the
  project-relative paths Storybook builds its sibling imports from. `dryRun`
  skips `commitOutputs` (the staged file list already existed since atomic
  EMIT), so a dry run is the real build minus the commit. Results carry
  `planned` (`{ path, bytes }`), `outDir` and `exporter`.
- CLI: the four flags, usage errors (exit 2) for a missing `--out` value, for
  `--quiet` with `--verbose`, and for a flag on a command that does not take it.
- `--verbose` and `TRANSTYLE_DEBUG=1` are one switch (`VERBOSE`); the crash
  hints (`TST3001`, `TST3002`) name `--verbose`.

## Decisions

- `--out` is `<dir>/<target name>` for every target (answered on the issue);
  prefix replacement has no sensible answer for configured outputs like
  `public/theme`.
- `NO_COLOR` stays a contract: the CLI prints no ANSI (the one color, `init`'s
  chip, already honors it); the golden test pins no ESC byte with and without it.
- `--quiet`/`--verbose` apply to `build` and `check` only. The other commands'
  output is the answer (`explain`, `diff`, `catalog`, `bindings`) or a one-line
  result (`init`, `add`), and accepting a flag that changes nothing is what the
  spec's "fail loudly" rule exists to prevent. The issue also listed `diff`,
  `init` and `add`; widening later is additive.
- A file's `report.json` `files` list stays project-relative, so with `--out`
  outside the project it holds `../` paths. Honest, and deterministic for a given
  `--out`.

## Deviations

None from a plan. `results[].planned` is new relative to the issue's sketch only
in also carrying byte sizes (for `--verbose`).
