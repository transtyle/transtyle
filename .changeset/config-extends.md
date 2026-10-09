---
'@transtyle/core': minor
'@transtyle/cli': minor
---

A config can extend a base, and every command takes `--config <file>`.

`"extends": "../design-system/transtyle.config.json"` inherits the base's tokens, modes, bindings, derivation, units and checks; the product adds its own targets (and token layers if it needs them). The nearer file wins: `tokens` are concatenated base first, `bindings` and `check.suppress` product first, `modes` and `targets` merge by entry, and `derivation`, `units` and `check` by key. Token globs resolve against the file that declares them, target outputs against the product. Each file is validated on its own, so `TST1010` names the file a bad key is in, and `report.json` and `check --json` list the files read as `config`. `--config` picks a config other than `transtyle.config.json`; its directory is the project directory. `compile()` takes the same option as `configFile`, core exports `loadConfigChain()` and `mergeConfigChain()`, and `loadConfig()` (what `transtyle migrate` reads) returns the merged config. Configs without `extends` build exactly as before, except for the new `config` line in each `report.json`.
