---
'@transtyle/core': minor
'@transtyle/cli': minor
---

`transtyle build --out <dir>` writes every target to `<dir>/<name>` (Storybook's imports of its siblings follow), and `build --dry-run` runs the whole build and lists the files it would write, `report.json` included, without touching the disk. `--quiet` keeps only errors and the diagnostics that fail the run; `--verbose` (same as `TRANSTYLE_DEBUG=1`) adds the exporter, output directory, file sizes and the stack of a crash. `NO_COLOR` is documented and pinned: the CLI never colors. `compile()` gains the `outRoot` and `dryRun` options and `results[].planned`, `outDir` and `exporter`.
