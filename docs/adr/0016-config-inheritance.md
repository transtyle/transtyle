# ADR-0016: A config can extend a base; the nearer file wins, token paths follow their file, outputs follow the product

**Status:** accepted

## Context

A project was one `transtyle.config.json` in one directory, picked by `--cwd`. Enterprise repositories hold several design systems, or several products that share one design system and build different targets from it ([issue #56](https://github.com/transtyle/transtyle/issues/56)). Each product needed its own copy of the shared tokens list, modes, bindings, derivation policy and checks, and the copies drift: the problem the compiler exists to remove. Since the issue was written the config grew keys whose merge behaviour also had to be decided: override layers (`tokens[].override`, [ADR-0009](0009-token-layering.md)), `bindings` ([ADR-0012](0012-binding-rules.md)), `targets.<t>.modes`, `units.remBase` and `check.suppress`.

"Config is data" ([configuration.md](../specs/configuration.md#config-is-data)) rules out computing one config from another in code. What remained to decide was how two data files combine, and where the relative paths of a base point once the base is read from another directory. Both are hard to change once configs in the wild depend on them.

## Decision

- **`extends`**: one string, a file path relative to the file that declares it (`./`, `../`) or absolute. Chains are followed to their root; a missing or unparseable base, a cycle, or a bare name stops the run with the chain in the message (exit 2, like a missing config). A bare name is refused, not read as a relative path, so package specifiers ([issue #55](https://github.com/transtyle/transtyle/issues/55)) can be added later without changing what an existing config means. **`--config <file>`** on every command picks the leaf, resolved against `--cwd`; its directory is the project directory.
- **Validation before merge.** Each file is validated against the config schema on its own, so `TST1010` names the file the bad key is in. `tokens` stops being required per file; at least one token layer is required after the merge.
- **Merge, the nearer file winning**, key by key:
  - `tokens` concatenated, base first (later layers win). Redefining a base token from a product is an override layer's job; no new mechanism.
  - `bindings` and `check.suppress` concatenated, the nearer file's entries first, because in both the first match wins. Diagnostics name an entry of a base with its file.
  - `modes` by dimension and `targets` by instance name, each entry replaced whole. A dimension's `values` and `default` belong together; a target's `options` hold arrays where a deep merge would surprise.
  - `derivation`, `units`, `check` by key (`check.contrast`, `check.hygiene` by key too). `derivation.require` is replaced, not concatenated: it is a policy, and a product may relax it.
  - `name` from the nearest file that sets one; `$schema` and `extends` never inherited.
- **Paths.** Token globs resolve against the file that declares them, and are rewritten relative to the project directory at LOAD, so nothing after LOAD knows about the chain. Target outputs resolve against the project directory wherever the target is declared (the maintainer's call on the issue, 2026-10-07): a base that declares a target has every product build it into its own folder. File names in diagnostics and provenance are relative to the project directory, so output is the same on every machine.
- **The chain is reported**, not hidden: `config` in `report.json` and `check --json` (root base first), and a `config:` line on stderr from `explain` when there is more than one file. `diff` snapshots what the chain reads; `add` writes into the leaf only and refuses a target inherited from a base.

## Alternatives not taken

- **One rule for every relative path, resolved against the file that declares it** (tsconfig's rule). Products extending a base that declares targets would all write into the base's `dist/` and overwrite each other; TypeScript 5.5 added `${configDir}` to work around exactly that for `outDir`. Splitting the rule by kind of path (inputs follow their file, outputs follow the product) costs one sentence in the docs and removes the trap.
- **A generic deep merge.** Simple to state, but it merges a target's `options` arrays and a dimension's `values` in ways nobody asked for, and it would decide silently for every key added later. An explicit table means a new key needs a decision.
- **`extends` as an array of bases.** Not needed for the cases in the issue. A string can become "a string or an array" later without breaking a config.
- **Removing an inherited target (`"<instance>": null`).** Left out; the guidance is to keep targets in the products. It can be added as its own change.
- **Concatenating `derivation.require`.** A product that cannot author a slot the base requires would have no way out.

## Consequences

- The config schema gains `extends` and no longer requires `tokens`; the report schema gains `config`. Both published files are regenerated (`gen:schemas`).
- No diagnostic code is added: a broken chain is a usage error, like a missing config, and the existing `TST1010`, `TST1001`, `TST1012`, `TST1117`–`TST1119` and `TST1301` messages name the file.
- `compile()` takes `configFile`; core exports `loadConfigChain()` and `mergeConfigChain()`, which `add` reads. The in-memory `compile()` of [issue #87](https://github.com/transtyle/transtyle/issues/87) takes a merged config: the chain stays on the file-system side of that split.
- Repository scripts read `examples/*/transtyle.config.json` as plain JSON, so the examples do not use `extends`; the fixture is `packages/core/test-fixtures/config-extends` (one base, two products with different targets), graded by `check:cli`.
