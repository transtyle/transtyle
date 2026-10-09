---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Core now records which catalog slots each exporter reads while it emits. Every target result of `compile()` carries `reads` (sorted `semantic.*` / `component.*` paths), each `report.json` gains the same `reads` field (optional in the published report schema), and `transtyle check --json` lists it per target. `consumption(result)` is exported from `@transtyle/core` and turns a compile result into the slot × target matrix that `transtyle check --matrix` prints; the CLI no longer wraps exporters to record reads itself. Emitted theme files are unchanged.
