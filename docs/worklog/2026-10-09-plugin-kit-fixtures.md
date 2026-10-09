# The plugin kit tested every exporter on one complete design system

Issue [#96](https://github.com/transtyle/transtyle/issues/96). `@transtyle/plugin-kit`
ran every plugin against one 14-token fixture, light and dark. Plan P1
([execution-2026-h2](../plan/execution-2026-h2.md#p1--plugin-conformance-kit))
promised "mode handling (single- and multi-dimension fixtures)", and the kit
never had them.

## The defect

Three exporter bugs found since then were invisible to it, because its only
fixture had none of the shapes that trigger them: a one-token design system
crashed Bootstrap (#23), object-form dimensions leaked `[object Object]` into
four targets (#24), an authored shadow wrote `NaN` (#26). `check:minimal-ds`
caught that class of bug for the official exporters, but through `compile()`,
inside this repo only. A third-party exporter running the kit inherited every
blind spot.

## The fix

Nine fixtures under `packages/plugin-kit/fixtures/<name>/`, each a plain DTCG
project compiled by the real loader (the old `fixture/` is `canonical`):
`canonical`, `one-token`, `three-token`, `two-dimension` (`color-scheme` ×
`density`, `space.4` authored differently under `compact`), `single-mode`,
`component-tier`, `custom-role`, `composites`, and `object-form` with a
string-form twin. All of them run by default; `fixtures: 'canonical'` is the
opt-out (Julien's call on the issue: a community exporter that passed the
alpha.3 kit may fail this one, which [ADR-0010](../adr/0010-pre-release-breaking-changes.md)
allows). `ctx.config` is now the fixture's own config, so an exporter reading
`ctx.config.modes` sees what `compile()` would give it.

Five checks, invariants that hold for any exporter:

- `files-non-empty` and `no-leaked-values`: `check:minimal-ds`'s invariants 2
  and 3. The two leak patterns moved into the kit (`LEAK`, `LEAK_INSIDE`) and
  `check:minimal-ds` imports them, so there is one copy.
- `coverage-honest`: invariant 4, the one that caught Storybook claiming five
  ThemeVars it never wrote.
- `mode-dimensions-accounted`, on `two-dimension`: the compact `space.4`
  (`0.8125rem`, or `13px` converted) reaches a file, or the plugin reports a
  `(mode:density)` `dropped` row. The value appears in no default-mode slot, so
  only the compact combo can put it in a file. Only `density` is checked:
  a `color-scheme` value has no string every target writes the same way.
- `structured-values-as-strings`, on `object-form`: the files are
  byte-identical to the string-form twin's, so a plugin reading `rawValue` (the
  token as authored) instead of `value` fails.

Each per-IR check carries its `fixture`, so a failure reads
`one-token: emit-runs`. `check:plugins` runs all nine official exporters and the
inline third-party plugin over every fixture, and adds a broken plugin per new
check (a `[object Object]`, an `undefined` after a colon, an empty file, a
`native` row for `semantic.color.border` on the one-token system, a plugin
dropping its `(mode:density)` row, a plugin printing `rawValue`), each failing
the check it breaks. The tier check (no row binds `option.*`) now runs over
every fixture too.

## Measured

All nine official exporters pass every fixture on `main` (85 to 95 checks
each: `options-schema-shape` runs only for an exporter with an
`optionsSchema`, and `emit-diagnostics-valid` once per fixture for one that
returns diagnostics, shadcn today). #23 and #24 were fixed before this landed, so
`one-token` and `object-form` joined in the same change instead of following
them, as the issue's refinement had planned.

Two things the new checks found in our own prose:

- The inline third-party plugin in `check:plugins` and the Alacritty exporter
  in [write-an-exporter](../../website/src/docs/write-an-exporter.md) both
  compile one mode and said nothing about `density`: both failed
  `mode-dimensions-accounted`. Both now report a `(mode:<dimension>)` `dropped`
  row for each dimension; the tutorial's code, extracted from the page, passes
  86/86.
- The kit's README destructured `{ passed, failures }` from `conformance()`,
  which returns `{ pass, checks }`, so the snippet as written always exited 1.

## Left out

`component-tier` and `custom-role` assert the checks above and nothing about
which authored tokens reach the output: whether an authored token with no
binding on a target may stay silent is #51's question. When it lands, an
`authored-tokens-accounted` check belongs on both. #51 proposes core appending
the `dropped` rows inside `compile()`; the kit calls `plugin.emit()` directly
and would not see them unless that row computation is a core helper the kit
calls too.

`check:minimal-ds` keeps its engine-level assertions (every mode shape,
`autoDark` provenance, TST1112, the binding layer, malformed composites naming
their member): they test core, not the plugin contract.
