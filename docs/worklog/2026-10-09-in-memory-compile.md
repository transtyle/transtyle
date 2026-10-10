# In-memory compilation and `@transtyle/core/browser`

Issue [#87](https://github.com/transtyle/transtyle/issues/87). `compile()` read the
config and the token files itself and wrote the outputs itself, so the playground
(ROADMAP P5), build-tool plugins, editors and tests had no way to say "here is the
project, give me the files" without a disk. The execution plan said core "runs
client-side unchanged"; it did not.

## What was built

- **`compileProject({ config, files, exporters })`** (`packages/core/src/pipeline.js`):
  the whole pipeline on a project held in memory. `files` maps each token file's
  POSIX path (relative to the project) to its contents, JSON text or a parsed
  object; `exporters` maps names to exporters (or pass `loadExporter` and
  `knownExporters`, as `compile()` does). It returns, per target,
  `{ target, output, files, coverage }`, with `report.json` always the last file,
  and writes nothing.
- **The project shape** is the virtual project Julien chose over the issue's
  pre-loaded token trees: the config stays the one source of truth for which files
  are layers, which are mode overlays and in what order, in both worlds, and every
  diagnostic names the same file. So the pure step expands `config.tokens` against
  the map's keys (`packages/core/src/project.js`, a port of the skeleton glob) and
  parses text itself, with the source locations of #157.
- **LOAD is split** where the disk ends: `loadProject(cwd)` (`load.js`) reads the
  config and the text of every file its globs match, and validates nothing; the
  config schema check (`TST1010`), the "tokens must list a glob" error, glob
  expansion, parsing (`TST1002`) and the structural checks (`TST1302`–`TST1307`)
  all moved into the pure step, so an in-memory project gets exactly the
  diagnostics `transtyle check` gives on disk. `writeResults(results, cwd)`
  (`emit.js`) is #149's atomic commit over `compileProject()`'s results.
- **`compile({ cwd })`** keeps its signature and results, including what landed
  the same day while this was in review: `outRoot` and `dryRun` (#185), the
  exporter manifest check (`TST1309`/`TST1310`, #190), the recorded `reads`
  (#193), `completeness:<level>` requires (#199), token metadata (#188), the
  contrast standard (#202), false-friend bindings (#200), reports built after
  the last target (#201) and Tokens Studio layers (#205), all now in
  `compileProject()`. The Tokens Studio reader (`tokens-studio.js`) reads the
  export from the map like every other token file; `loadProject()` puts every
  `.json` file of an export folder in it. APCA's loader, which
  resolves `apca-w3` from the project with `node:module`, moved to `apca.js`
  (`loadApca`, `loadContrast`, still exported from the main entry); the pure
  step takes an `apcaLoader`, which `compile()` fills with it. `suggestBindings({ cwd })` (#191) reads
  through `loadProject()` and stays on the main entry (`files` = written paths,
  `emitted` = the exporter's files) and is now the composition of the three.
- **`@transtyle/core/browser`** (`browser.js`, a new `exports` entry): everything
  the main entry exports except `compile`, `loadProject` and `writeResults`. Only
  `load.js` and `emit.js` import from Node, and nothing in `browser.js`'s graph
  reaches them.
- **Exporters**: `exporter-bootstrap` and `exporter-primeng` read
  `surface-inventory.json` with `readFileSync` at import time, and `exporter-mantine` and `exporter-chakra`
  (whose inventories landed the same day, #173 and #198) on first use; all four now import it
  as a JSON module (`with { type: 'json' }`), which Node 22.12 (the `engines` floor
  and CI's version) loads without a warning. Mantine read lazily because its
  extractor imports `collapseVariable` from the same module before the inventory
  exists; that function moved to `src/collapse.js`, which the extractor now imports
  (`surface-coverage.js` re-exports it).
- **`check:browser`** (`scripts/check-browser.mjs`, in `check:all` and CI): loads the
  module graph of `core/browser` and the eleven exporters into a fresh `node:vm` context
  (no `process`, `Buffer`, `require`, `import.meta.url`: only ECMAScript), refusing
  a Node built-in, a non-workspace bare specifier or a dynamic `import()`; compiles
  the four examples there and byte-compares every file, `report.json` included,
  with a `transtyle build` of a temp copy; repeats with the token files as objects
  (same files, `report.json` minus source locations); and compares glob and path
  edge cases with the disk. Broken on purpose: restoring the `node:fs` read in the
  Bootstrap exporter fails the link step naming the file, and a one-byte difference
  in the in-memory `report.json` fails every example naming each file.

## Measured

- The four examples compiled by `main`'s `compile()` and by the new one into temp
  copies, plain and with `outRoot`, `dryRun`, `emit: false` and an unknown target:
  every written file, every result field and every diagnostic identical (Node 23.1;
  the plain build also on 22.12).
- The browser graph is 56 modules; the sandbox needed no host global at all
  (`structuredClone`, the only web API core uses, is only reached by `catalog()`).

## Findings

- The README's example read `result.report.coverage`, which `compile()` never
  returned, and called `compile()` without `loadExporter`, which throws as soon as a
  config has targets. Rewritten, with the in-memory form next to it.
- The skeleton glob let a `*` in the middle of a pattern match files
  (`tokens/*/x.json` tried `tokens/a.json/x.json` and failed with `ENOTDIR`) and a
  final `*` match directories (`EISDIR`). In memory a directory exists only through
  the files under it, so the pure glob matches directories in the middle and files
  at the end. No example used either case; outputs are unchanged.
- A token file that could not be read reported Node's message with its absolute
  path (`ENOENT: …, open '/Users/…'`). It now reads
  `Failed to parse tokens/x.json: no token file at this path`, the same in both
  worlds.
- `report.json` paths came from `path.relative()`, so a Windows build listed
  `dist\shadcn\…`. They are POSIX now, which also makes the report the same bytes
  on every platform.
- CI's step list misses five scripts `check:all` chains (`check:atomic-emit`,
  `check:explain`, `check:rem-base`, `check:matrix`, `check:gamut-rows`), and
  `scripts/README.md`'s table lacks three of them. Filed as
  [#187](https://github.com/transtyle/transtyle/issues/187) rather than fixed here.

## Deviations

- The issue proposed a bundler smoke test with esbuild. It is a `node:vm` module
  linker instead: zero new dependencies, and a stricter test of "browser-safe" (a
  bundle run in Node still has every Node global; the vm context has none). What a
  bundler needs on top, a static import graph and JSON modules, is what the link
  step enforces.
- The issue's acceptance named Acme; `check:browser` runs all four examples, as the
  refinement asked.

## Rebased onto `extends`, the manifest, the perf budget and custom vocabulary

2026-10-10. Four PRs landed on `main` while this one waited, all inside the old
monolithic `compile()`: config inheritance (#207), the emitted-file manifest and
drift detection (#209), the 10,000-token budget (#210) and custom-vocabulary
accounting with `buildReport()` in `report.js` (#211). Each went to the side of the
split it belongs to:

- **The `extends` chain is the disk's.** `extends` is a file path, so
  `loadConfigChain()` and `mergeConfigChain()` stay in `load.js`. `compile()` checks
  each file of the chain against the schema before merging (so `TST1010` names the
  file), merges, and hands `compileProject()` one merged config plus the chain's
  file names (`configChain`, which `report.json` lists and the last of which names
  the config in diagnostics) and `mergeConfigChain()`'s `origins` (so `TST1001`,
  `bindings[i]` and `check.suppress[i]` name the file and entry the user wrote).
  `loadProject()` follows the chain too, so a base's token files reach the map as
  `../base/…`. A config that still has `extends` is refused by `compileProject()`
  rather than silently compiled without its base. The alternative, merging inside
  `compileProject()` from a chain of in-memory configs, would give a browser host
  `extends` too, but no in-memory caller has more than one config today.
- **The manifest and drift are the disk's.** Both describe an output directory.
  `compileProject()` returns no manifest; `compile()` renders one per target from
  the files it got and adds it after `report.json`, in the same atomic write.
  Drift has to land where `main` reports it, after the shared checks and before
  the first exporter, so `check.suppress` applies and every `report.json` lists
  it: `compileProject()` takes a `checkOutputs(targetNames)` callback that returns
  diagnostics, called once at that point, like `apcaLoader` and `loadExporter`
  are the disk's other callbacks. `compile()` reads the previous manifests there
  and keeps them for the `stale` list.
- **Custom vocabulary and `buildReport()` are pure** and run in
  `compileProject()`, so `@transtyle/core/browser` exports `customTokens`,
  `accountCustomTokens`, `isCustomRow`, `customVocabularySentence`,
  `CUSTOM_MEANING`, `buildReport` and `REPORT_SCHEMA_ID`. `MANIFEST_FILE`,
  `hashContents`, `loadConfigChain`, `mergeConfigChain` and `DEFAULT_CONFIG_FILE`
  stay on the main entry.
- **#210's Mantine speed-up** moved with `collapseVariable()` into `collapse.js`.

Findings:

- `check:browser` caught a host global: #211 calls `isCatalogSlot()` on every
  compile, which reaches `catalog.js`'s `structuredClone`. That is an HTML and Node
  API, not ECMAScript, so the sandbox has none. `catalog.js` now copies its
  JSON-safe data with `JSON.parse(JSON.stringify())`; `catalog()` returns the same
  value.
- `check:perf` showed `compileProject()` building eleven `report.json` strings that
  `compile({ emit: false })` throws away: a 10,000-token `check` took about 20%
  longer than on `main`. `compileProject()` now takes `reports: false`, which
  `compile()` passes without `emit`. A target that never ran is marked
  `skipped: true`, since "no files" no longer says it.

Measured: `main`'s CLI and this branch's on the four examples, both
`config-extends` products (also through `--config` from the fixture root),
`mode-dimensions`, `bindings-rules`, `override-layers`, `glob-plus-overlay`,
`component-tier`, the two error fixtures and plugin-kit's `custom-vocabulary`, each
through `check`, `check --json`, `build --dry-run`, `build` twice, an edited and a
deleted output file (`TST1312`, then `build`) and `build --out`: every byte of
stdout, stderr, exit code and output tree identical. Through the API, `compile()`'s
whole result (diagnostics included) identical for `emit: false`, `dryRun` with
`drift`, a stale file in the manifest, an exporter that fails to load, one with an
incompatible or missing manifest and one that crashes. `check:perf` on this machine,
five runs each: median compile 901 ms on `main`, 905 ms here; peak RSS too noisy to
rank (845–1301 MB on both). The browser graph is 59 modules now.
