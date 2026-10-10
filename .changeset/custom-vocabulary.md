---
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/plugin-kit': minor
'@transtyle/exporter-css-variables': minor
'@transtyle/exporter-daisyui': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-primeng': patch
---

Custom semantic tokens (your own `semantic.*` names outside the catalog) are now accounted for on every target. After each exporter runs, core sorts them into the ones the target writes under their own name, the ones that reach it through a catalog slot bound to them, and the ones with no path, which get a `dropped` coverage row named `(custom:<path>)` with the meaning `custom.vocabulary`. `report.json` carries the counts as `coverage.customVocabulary`, `usage.md` gains a "Custom vocabulary" section, and the build prints `custom vocabulary: 14 tokens, 10 reach this target via bindings, 4 have no path` under the target's bar, whose percentages leave these rows out. Core exports `customTokens()` (the same definition as the adoption report's) and passes the list to exporters as `ctx.customTokens`.

An exporter can declare `openVocabulary: true` when its target takes any variable name. css-variables already wrote every custom token and now declares it; daisyUI now writes them into its theme blocks too (`semantic.color.crt.ink` → `--color-crt-ink`). Both accept `options.customTokens: "omit"` to leave them out. plugin-kit gains a `custom-vocabulary` fixture and three checks for open-vocabulary exporters.

The Bootstrap exporter reports `$spacer`, `$font-size-base` and `$line-height-base` on rows of their own, with their exact slot, so `transtyle explain --variable '$btn-line-height' --target bootstrap` now ends at `semantic.type.leading.normal` (Acme: 714 rows become 717). The PrimeNG exporter reports its content text colours (`text.color`, `text.mutedColor` and their hover twins), which it already emitted (Acme: 356 rows become 360).
