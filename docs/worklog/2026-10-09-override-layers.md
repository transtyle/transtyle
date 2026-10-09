# Explicit override layers

Issue [#57](https://github.com/transtyle/transtyle/issues/57). `TST1103` warned for every token redefined across base layers, which is wrong for enterprise layering (core, business unit, product), where redefining is the point.

## What landed

- Config: a layer may be `{ files, override: true | "extend" }`, alone or with `mode`. The schema requires `mode` or `override` on the object form and rejects other `override` values (`npm run gen:schemas` regenerated the published config schema).
- Merge: `mergeTrees` (`packages/ir`) passes the layer index to `onConflict` and takes an optional `onDefine`; `normalize.js` tracks which layer defined each token. A marked layer's redefinitions are silent; an unmarked layer warns `TST1103` as before.
- `TST1116` (next free code after `TST1112`): `override: true` defining a token no earlier layer defines; one report per layer when it is the first. `override` also suppresses `TST1108`.
- Provenance: `layer` and `overrides` on the entry's provenance; `explain` prints `overrides <file>`. The report schema's provenance `kind` enum is untouched.
- Loader fix on the way: the files an entry claims (so they are not also loaded by a plain glob) are now only those of mode-scoped entries; an `override` entry has no mode and must not claim its file away from itself.
- Docs: authoring-tokens, configuration, diagnostics, `docs/specs/configuration.md`, `validation-and-coverage.md`, ADR-0009 amendment.

## Measured

`scripts/check-cli.mjs` grades `packages/core/test-fixtures/override-layers`: marked layer, zero `TST1103`; the unmarked twin, two (one per redefined token); typo, extend, first-layer, `explain`, and both schema rejections. Cathode has no `TST1103` today (refinement on the issue), so the acceptance is shown on the fixture, not on the example.
