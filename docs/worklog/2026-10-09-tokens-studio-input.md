# Tokens Studio exports as input

Issue [#52](https://github.com/transtyle/transtyle/issues/52). The alpha audience mostly got its DTCG tokens from Tokens Studio, and loading an export meant rewriting it: a folder given to `tokens` failed with `TST1002` (`EISDIR`), a glob over the set files raised `TST1305` for every top-level group and `TST1306` for every Tokens Studio type, math reached the exporters as text, and a legacy-format file stopped at `TST1307`.

## What landed

- Config: a third layer form `{ tokensStudio, themes?, sets? }` (schema regenerated with `npm run gen:schemas`). Folder or single-file export; theme groups map to mode dimensions (`map`) or are compiled with one theme (`fixed`); sets are placed under a tier (default `option`) with references rewritten, per the maintainer's answer on the issue (option A).
- LOAD (`packages/core/src/tokens-studio.js`): set order and themes, the legacy format (`TST1005`), the type table and value conversions from the refinement, color modifiers refused (`TST1007`), and the lowering: themes at the defaults merged into a base layer, one mode-scoped layer per other value with only what differs. With two or more groups every combination of non-default themes is compared with what stacked per-dimension overrides give, and a difference is `TST1008`, as is a token only a non-default theme defines.
- NORMALIZE (`packages/core/src/expressions.js`, `normalize.js`): expressions evaluated per mode after their references resolve, top-level and as composite members. Zero-dependency parser, no `eval`; `TST1006` outside the subset.
- Provenance `source` (file, set, Tokens Studio path, line) and `expression`; `explain` prints both, on the alias targets it now walks too (#177), so a bound catalog slot shows its source one level in.
- Codes `TST1003`–`TST1009` (the free LOAD range, re-checked after each rebase, last on #202; `TST1109` and `TST1105` reused for an undeclared mode value and a dangling reference in an expression).
- Docs: `docs/specs/configuration.md`, `validation-and-coverage.md`, `cli.md`, `pipeline.md`, ADR-0014, the website's configuration, adoption, diagnostics, CLI and roadmap pages, README and ROADMAP.

## Measured

`scripts/check-tokens-studio.mjs` (in `check:all` and CI): the hand-written fixture compiles on all 12 target instances with no error, and its folder, single-file and legacy forms emit byte-identical files to the same data written as plain DTCG plus a mode-scoped layer (96 files each). Explain, a two-group export, a fixed group, interacting groups, seven failing exports and sixteen evaluator cases are graded too.

## Deviations from the refinement

- Lowering is not shared with #53 (the resolver module has no code yet): it lives in `tokens-studio.js`, and ADR-0014 says the second of the two to land reuses the other's.
- A token a non-default theme leaves out carries the default value over with a warning (`TST1009`) rather than an error: Tokens Studio would leave every reference to it broken in that theme, so neither reading matches it exactly, and the carry-over is the one that still builds.
- The legacy format reuses the Style Dictionary leaf detection that #184 shares with `migrate --from style-dictionary`; the rest of that codemod does not apply (Tokens Studio types, `description` rather than `comment`, tiers placed per set).
- `fontFamilies` lists become arrays at LOAD: a string `fontFamily` crashes four exporters on plain DTCG too, filed as [#183](https://github.com/transtyle/transtyle/issues/183). Color modifiers are [#182](https://github.com/transtyle/transtyle/issues/182).
