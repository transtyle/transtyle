# Config inheritance (`extends`) and `--config`

Issue [#56](https://github.com/transtyle/transtyle/issues/56). A project was one
`transtyle.config.json` per directory, picked by `--cwd`, so several products
sharing one design system each carried a copy of its tokens list, modes,
derivation and checks.

## What was built

- `packages/core/src/load.js`: `loadConfigChain()` finds the config
  (`--config`, resolved against `--cwd`) and follows `extends` to the root;
  `mergeConfigChain()` merges it with the table in
  [ADR-0016](../adr/0016-config-inheritance.md). Token globs are rewritten
  relative to the project directory at LOAD, so NORMALIZE, DERIVE, the checks
  and the exporters are unchanged: they see one merged config.
- `compile()` validates each file of the chain on its own (`TST1010` names the
  file), takes `configFile`, resolves outputs against the project directory and
  returns `configChain`, which `report.json` (`config`, schema regenerated) and
  `check --json` carry.
- Messages that named `transtyle.config.json` literally (`TST1001`, `TST1301`,
  `TST3002`, the bindings layer's file) name the actual file; a `bindings` rule
  or `check.suppress` entry from a base is labelled with its file
  (`bindings[0] in ../base/transtyle.config.json`).
- CLI: `--config` on every command; `explain` prints the chain on stderr;
  `add` writes into the leaf and refuses a target a base declares; `init
--config` writes that file; `diff` archives the whole repository when the
  build reads outside the project directory, and reads a base outside the
  repository as it is now, saying so.
- `loadConfig()` (exported for `transtyle migrate`) follows and merges the
  chain too, so `migrate --from style-dictionary` walks every token file the
  build reads, a base's included, named relative to the config's directory.
  `bind --suggest` reads the merged chain the same way. `build --out` still
  replaces every output, relative to the shell.
- Fixture `packages/core/test-fixtures/config-extends` (one base, two products
  with different targets, one product layer bound by the base's rule), graded
  by 54 new `check:cli` assertions, including the merge table key by key.

## Findings

- The issue's merge table predates override layers, `bindings`, per-target
  `modes`, `units` and `check.suppress`. Override layers needed nothing: a
  product redefining a base token is a later layer, so `override: true` already
  says it. `bindings` and `check.suppress` are the two lists where the first
  match wins, so they concatenate with the nearer file first, unlike `tokens`.
- `diff` already broke for a single config whose token glob climbs out of the
  project (`../shared/tokens/*.json`): it archived the project directory only.
  The same rule (archive the repository when anything is read from outside the
  project) fixes both.
- Every `report.json` gains one line, `config`, with one entry for a config
  without `extends`. No example output changed otherwise; `check:determinism`
  is unaffected because the names are relative.

## Deviations

- The refinement named the ADR 0012; binding rules, APCA and Tokens Studio took 0012
  to 0014, so this is ADR-0016 (0015 went to mode combinations meanwhile).
- The refinement proposed `compile({ config })`; the option is `configFile`,
  because `compile()` already returns the merged config as `config`.
- `tokens: []` in a single config is now `TST1010` (exit 1) instead of a thrown
  error (exit 2): the schema check runs before the token check. A config with no
  `tokens` key still exits 2 with the same message as before.
