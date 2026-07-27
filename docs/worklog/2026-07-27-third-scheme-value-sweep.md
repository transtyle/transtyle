# Sweeping the third `color-scheme` value (`three-scheme`'s `dim`)

The mode-shape harness's `three-scheme` shape (`color-scheme: [light, dark, dim]`)
authored dark distinctly (previous worklog) but left `dim` all-light — the same
gap that dark had before that sweep, just on the shape that's already the
harness's edge case.

## What `dim` actually tests

It's worth being precise that this is a different kind of test than the dark
sweep. `derive.js`'s `isDark` is a literal `=== 'dark'` check, so a third
scheme value is never "dark" by the engine's own definition — nothing about
`dim` is supposed to trigger dark-mode derivation. And structurally, **no
exporter binds a `color-scheme` value beyond light/dark at all**: every
exporter's binding is `:root` / `.dark` (or the exporter's equivalent), never
data-driven off the configured value list. A `dim` value compiles cleanly
today (`check:minimal-ds` was already green on `three-scheme`) but reaches
zero emitted output anywhere — that's a known, current limitation of every
exporter, not a bug, and not something a test harness fixes by asserting
harder.

What's actually worth testing is narrower: does the **engine** — `normalize`'s
per-dimension resolution, specifically — keep a third value's authored data
distinct as it flows through the pipeline, or does something silently collapse
it into `light` or `dark`? That's a real risk surface: `modeValues[scopeDim]`
is a dict keyed by mode value, and until this sweep nothing had ever put two
non-default keys in it for the same dimension in the same test run.

## What changed

`EXTRA_SCHEME_TOKENS` (renamed from the single `DARK_TOKENS`) now holds a
distinct surface + text per authored value — `dark` (`#101114`/`#f8f9fa`, from
the previous sweep) and `dim` (`#2b2417`/`#f5ecd9`, new). `writeConfig` scans a
shape's `color-scheme.values` and adds a mode-scoped layer for every
non-default value it has fixture data for, rather than special-casing `dark`.

The fifth invariant is now pairwise: every authored value's `semantic.color.surface`
must reach its own combo map (`normalized.modes.<value>`) and be distinct from
light **and** from every other authored value — so a resolution bug that
collapsed `dim` onto `dark`'s slot, or a glob change that stopped picking up
one of the two fixture files, fails loudly. Verified by forcing `dim`'s
authored surface to equal `dark`'s and confirming every exporter's row in
`three-scheme` failed with "indistinguishable from dark."

`check:all` green at 63.
