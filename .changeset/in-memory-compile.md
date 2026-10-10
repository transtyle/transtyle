---
'@transtyle/core': minor
'@transtyle/exporter-bootstrap': patch
'@transtyle/exporter-chakra': patch
'@transtyle/exporter-mantine': patch
'@transtyle/exporter-primeng': patch
---

Compile without a filesystem: `compileProject()` and a browser entry, `@transtyle/core/browser`.

`compileProject({ config, files, exporters })` takes the config and the token files as a map of paths to contents (JSON text, or parsed objects) and returns every target's files, `report.json` included, without writing anything. They are byte for byte what `transtyle build` writes. `@transtyle/core/browser` exports it with the rest of the API and reaches no Node built-in, so the compiler runs in a browser, a worker, an editor or a test. `compile({ cwd })` keeps its signature and results; it is now `loadProject(cwd)` → `compileProject()` → `writeResults(results, cwd)`, all three exported. Only the disk keeps two things: an `extends` chain (file paths: `loadProject()` and `compile()` follow and merge it, and pass `compileProject()` the merged config with `configChain` and `origins`, so diagnostics still name the file a key is in) and the emitted-file manifest with its drift check (`compile()` adds `transtyle-manifest.json` to the files it writes, and reports `TST1312` through `compileProject()`'s `checkOutputs` callback). `compileProject()` also takes `reports: false` to skip `report.json` when nothing will read it, as `compile({ emit: false })` does. The browser entry exports the custom-vocabulary helpers and `buildReport()` too. The Bootstrap, PrimeNG, Mantine and Chakra exporters import their `surface-inventory.json` as a JSON module instead of reading it from disk, so they load in a browser too.

Small changes on the disk path: a `*` in the middle of a token glob now matches only directories and a final `*` only files (a directory matched by a final `*` used to fail with `TST1002`), a token file that can't be read reports `TST1002` as "no token file at this path" instead of Node's error with its absolute path, and `report.json` paths use `/` on every platform.
