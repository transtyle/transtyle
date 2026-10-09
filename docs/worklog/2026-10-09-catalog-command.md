# `transtyle catalog`: the semantic contract as data

Issue [#65](https://github.com/transtyle/transtyle/issues/65). The catalog was
stated twice and checked by hand: in prose (`ir.md`, `language.md`) and in code
(`packages/ir`, the inline rules of `derive.js`, `COMPONENT_CATALOG`). Anything
that wanted it as data (an editor, the playground, an agent, the token-file
schema of [#64](https://github.com/transtyle/transtyle/issues/64)) had to
re-derive it from one of those.

## What landed

- `catalog()` in `@transtyle/core` (`packages/core/src/catalog.js`) and
  `transtyle catalog [--json]` in the CLI. The object and its fields are
  specified in [cli.md](../specs/cli.md#catalog--the-contract-as-data).
- **A probe compile, not a rule table.** `derive.js` declares no rule anywhere
  but in the closure that runs it; the rule name and inputs exist only in the
  provenance a compile records. Two ways to get them: refactor `derive.js` into
  a declarative table both the engine and `catalog()` read, or compile a
  built-in design system that authors every anchor (placeholder values) in
  light and dark and read the provenance back. Julien chose the
  probe: it can't drift from the engine and leaves every output byte-identical,
  where the refactor rewrites the engine for the same answer. `requires` comes
  from one more probe per optional anchor with that anchor left out.
  `primary.solid` is never left out (TST1201: the engine stops without it).
- **`--target` stays out**, moved to the slot × target matrix
  ([#95](https://github.com/transtyle/transtyle/issues/95)), also Julien's call:
  coverage rows name slots as free text in several exporters (patterns, ranges,
  prose), so per-target consumers need a mapping that #95 and
  [#98](https://github.com/transtyle/transtyle/issues/98) need too.
- **The language page stays hand-written, held to the catalog.** Its tables
  carry meaning and swatches the catalog has no field for. `check-docs.mjs`
  (section 7) now reads their first column and the component table's "Defaults
  from" column, expands the page's shorthand (`<role>.`, `-hover` and `.hover`
  fragments, `*`, `1..4`, `1–8`, `component:`) and fails on a name that is not a
  catalog slot and on a catalog slot with no row.

## What was measured

259 slots: 252 semantic (8 roles × 16 cells = 128, elevation 10, scrim,
text 6, link 3, border, ring, palette 8, radius 9, font 3, space 13, size 3,
border-width 3, opacity, breakpoint 6, z 10, type 36, duration 5, easing 5)
and 7 component. 168 derived, 84 defaulted, 7 authored only (`text.base` is defaulted from the canvas since [#154](https://github.com/transtyle/transtyle/pull/154); the probe, which authors it, reads its rule from the probe that leaves it out). The refinement on
the issue counted 250 semantic from the examples before `radius.none` was
derived ([#140](https://github.com/transtyle/transtyle/pull/140), merged
while this was in progress: the catalog picked it up with no change here). None
of the examples authors `font.display`, which the engine reads when present, so
the probe, which authors every anchor, has one more. Rule names and inputs are the same in light
and dark for every slot; `catalog()` throws if that ever changes. The whole
probe (8 compiles) runs once per process, well under 100 ms.

## Drift it found

- **`check:grid` asserted 54 hand-listed slots**, mostly primary's grid and one
  key per scale. It now takes the list from `catalog()` (the 250 slots a rule
  fills) and checks the other direction too: a slot the engine fills on Acme
  that the catalog doesn't list fails it.
- **`language.md` missed ten slots**: `radius.none`/`sm`/`lg`/`xl`/`full`
  (derived from `radius.md`, never named), `radius.control`/`field`/`container` (named
  only as bare words), `font.display` and `opacity.disabled`. All have rows now.
- **`ir.md` lists `font.serif`**, which nothing derives, defaults or reads (no
  exporter, no example; `radius.none` was in the same state until #140). It
  stays in the spec as a reserved name, marked so, and `catalog()` doesn't list
  it: the catalog says what the engine implements. Dropping it from the spec,
  or listing it as an authored-only slot, are the two alternatives; either is a
  one-line change later.
- **`derivation.md` promised "the full table ships as a generated reference
  doc in a later pass"**: that is `transtyle catalog` now, and the sentence
  says so.

## The token-file schema

The token-file schema ([#64](https://github.com/transtyle/transtyle/issues/64),
merged while this was in progress) read the catalog through its own minimal
compile plus hand-added IR constants, and its worklog asked for `catalogSlots()`
to become a call to `catalog()` once this landed. It is one now; the published
`website/public/schemas/tokens/v0.json` regenerates byte-identical, which is
also an independent confirmation that both readings found the same 259 slots.

## Not done here

- Custom roles and custom semantic tokens of a project are its own vocabulary;
  `transtyle catalog` reads no project. The adoption report
  ([#61](https://github.com/transtyle/transtyle/issues/61)) is where a
  project's view belongs.
