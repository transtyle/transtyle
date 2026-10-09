# Custom vocabulary on every target, and Bootstrap's three scalar roots

Issue [#51](https://github.com/transtyle/transtyle/issues/51): the adoption
playbook tells a design system to keep its own names as custom `semantic.*`
tokens and bind the catalog to them, but on the output side their fate was
invisible. Closed-set exporters ignored them without a row; only css-variables
wrote them. Issue [#179](https://github.com/transtyle/transtyle/issues/179),
done in the same change: three Bootstrap variables the exporter drives had no
coverage row of their own, so `explain --variable` chains through them ended at
"(no coverage row names it)". Built on the refinement appended to #51.

## What was done

- **Core.** A new `custom.js`: `customTokens(normalized)` lists the `semantic.*`
  paths outside the catalog (not `isCatalogSlot()`, not a custom role cell:
  the adoption report's definition), and `accountCustomTokens()` runs after
  each exporter's `emit`: a token is **emitted** (an emitting row names it),
  **reached** (on the alias, rule-input or composite-member chain of a slot an
  emitting row names, in the default mode) or
  has **no path**, and then gets one `dropped` row
  `(custom:<path>)` with the meaning `custom.vocabulary`, unless the exporter
  already named it. Counts go to `report.json` as `coverage.customVocabulary`
  (schema regenerated), to `usage.md` as a "Custom vocabulary" section, and to
  the CLI as a line under each target's bar. The list reaches exporters as
  `ctx.customTokens`.
- **Open-vocabulary exporters.** A new optional `openVocabulary: true` on the
  exporter object. css-variables declares it (it already wrote every custom
  token); daisyUI now writes them into its theme blocks with css-variables'
  naming, skips a name the block already uses (Cathode's `crt-amber` role and
  its `crt.amber` token) and reports a composite `dropped`. Both take
  `options.customTokens: "emit" | "omit"`.
- **plugin-kit.** A tenth fixture, `custom-vocabulary` (a color bound to
  `primary.solid`, an unbound color, a dimension, a shadow), `ctx.customTokens`
  in the kit's context, and three checks: `open-vocabulary-shape`,
  `custom-vocabulary-carried`, `custom-vocabulary-omit`, each with a negative
  test in `check:plugins`. Every official exporter runs on the new fixture.
- **Bootstrap (#179).** `$spacer` (`semantic.space.4`), `$font-size-base`
  (`semantic.type.size.md`) and `$line-height-base`
  (`semantic.type.leading.normal`) get a row each; the ladders they sat in keep
  one row, narrowed to `$h1-font-size…$h6-font-size` and `$spacers`, with their
  slots in `slots`. The CSS-path button variant row names its role cells in
  `slots` too.
- **PrimeNG.** Its content text colours (`text.color`, `text.mutedColor` and
  the hover twins) had no row although the preset writes them, which made the
  tokens bound to `text.muted` read as dropped. Four rows added.
- **Guards.** `gen-catalog-signals` lists the custom tokens each target drops,
  per example, in their own section (they are not catalog-side `dropped` rows),
  validates meaning keys on `dropped` rows too, and fails when a token reported
  `dropped` is aliased by a slot the exporter reads (the `reads` that `compile()`
  records, #193). Taking the PrimeNG rows out makes it fail on all three
  examples that bind `text.muted`, as it should. `check:doc-numbers` leaves the
  custom rows out of every coverage number, as the CLI does, and gains
  `<example>.custom` and `<example>.<target>.custom.<emitted|reached|dropped>`.

## Measured

- Custom tokens: Acme 0, Cathode 7, GOV.UK 14, Carbon 15 (`<example>.custom`).
- GOV.UK on Bootstrap: 10 reach it through bindings, 4 have no path
  (`govuk.link`, `link-hover`, `link-visited`: Bootstrap's link colour follows
  `primary.solid`, not `link.*`; and `focus-text`, which nothing binds). On
  css-variables and daisyUI all 14 are written.
- Acme: Bootstrap 714 rows become 717 (60 native, 491 derived), PrimeNG 356
  become 360. GOV.UK's daisyUI bar moves to 58% native (its 14 custom tokens
  are now native rows of the target).
- `explain --variable '$btn-line-height' --target bootstrap --cwd examples/acme`
  ends at `semantic.type.leading.normal`; `$navbar-padding-y` at
  `semantic.space.4`, `$btn-font-size` at `semantic.type.size.md`.

## Deviations from the refinement

- **No `isCatalogSlot` in `@transtyle/ir`.** The adoption report (#200),
  merged while this was in progress, added `isCatalogSlot()` to core's
  `catalog.js`, read off the engine; `customTokens()` uses it, with the same
  custom-role rule as `adoption()`, so the two agree on what is custom.
- **`usage.md` gets its sentence from core**, appended the way the
  `targets.<t>.modes` note is, instead of counts passed in `ctx` to every
  `renderUsage()`: what reaches a target is only known after its `emit`.
- **`customVocabulary` has four counts**, `emitted` beside `total`, `reached`
  and `dropped`: on css-variables "reached via bindings" would be wrong for
  tokens written under their own name.
- **The custom token counts are 7, 14 and 15**, not the refinement's 10, 16
  and 17: these are the engine's, now under `check:doc-numbers`.
- **`docs/specs/diff.md` is unchanged**: `transtyle diff` compares resolved
  values and emitted files, and reads no coverage row.
- **Chakra, Mantine and MUI are not open-vocabulary.** Chakra's
  `semanticTokens`, Mantine's `other` and MUI's palette could carry custom
  tokens; they stay closed-set here, and their tokens are accounted for like
  Bootstrap's. MUI, merged while this was in progress, needed nothing: core's
  pass covers it, and the read guard passes on it.
