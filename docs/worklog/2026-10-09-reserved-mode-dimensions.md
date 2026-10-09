# Contrast, motion and brand reach the targets

Issues [#50](https://github.com/transtyle/transtyle/issues/50) (`contrast` and
`motion` in the CSS targets) and [#49](https://github.com/transtyle/transtyle/issues/49)
(`brand` with an encoding per target), one change because they share every
piece: how a combination is authored, how a CSS target writes a dimension
beyond `color-scheme`, and how `check` sees the combinations. Decisions in
[ADR-0015](../adr/0015-mode-combinations.md).

## The defects

Both refinements found the same bug from two sides. css-variables, the one
target that already wrote extra dimensions, computed each `[data-<dimension>]`
block from the light combination only and wrote it after the dark block at the
same specificity. Density changes no color, so Acme never showed it; with
`contrast` or `brand` declared, a page with `data-color-scheme="dark"` and
`data-contrast="more"` got the light `more` values (muted text at 1.1:1 on the
dark canvas in the #50 probe, Globex's light primary in the #49 one).

Underneath, there was no way to write the right value: a mode-scoped layer
could name one dimension (`TST1110`), and NORMALIZE gave a token with values on
two dimensions the later one's value, silently. And `check` looked at the
scheme's own combinations only (`light`, `dark`), so the 1.1:1 pair raised
nothing.

## What changed

- **Combo layers** (Julien's call on #50): a layer may name several
  dimensions; its values apply to that combination and win there. The most
  specific matching layer wins, then the later one. `TST1110` now rejects a
  layer naming none. A token left ambiguous is `TST1125` (TST1113, the code the
  #49 refinement proposed, went to tier violations in #142).
- **Derivation, authored always wins** (Julien's call on #50): `contrast-more`
  aims the on-brand walks at 7:1 and mixes `text.muted` / `text.subtle` only as
  far as 7:1 / 4.5:1 allow; `motion-reduced` makes unauthored durations `0ms`.
  An authored value is never touched.
- **`check` on every combination**, `contrast: more` at 7:1. A pair whose colors
  were already measured under the scheme's name adds nothing, so density adds
  no warning. The role on-color warnings of DERIVE are now one per failure
  naming every combination, instead of one per combination: the motion and
  brand axes multiplied the same `on-solid` shortfall by four in the fixture.
- **`modeBlocks()`** in `@transtyle/ir` plans the blocks for css-variables,
  shadcn, Radix and Bootstrap's CSS path. It simulates the cascade the target's
  own `:root` and dark blocks start, then, smallest combination first, writes
  each block with only the declarations the earlier blocks would get wrong.
  A combination whose values the cascade already gives (dark + compact) gets
  no block, which is what keeps Acme byte-identical. `contrast: more` and
  `motion: reduced` blocks are written again inside their media query, with
  `:not([data-<dimension>])` so an explicit attribute, the default included,
  wins over the OS.
- **`emitPerValue()`** runs an exporter once per brand on the IR pinned to it
  (`pinDimension()`): PrimeNG, Mantine, Chakra, MUI and Bootstrap's Sass files.
  ECharts names a theme per brand and scheme, daisyUI a theme per combination,
  Storybook adds a toolbar per dimension. Every other case is a `dropped` row
  with its reason (`droppedDimensions()` takes one now).
- The `brand` value pattern is in the config schema (`TST1010`), regenerated
  with `gen:schemas`.

## How it is checked

`packages/core/test-fixtures/mode-dimensions` declares color-scheme × contrast
× motion × brand (16 combinations) and authors `more` values for light and,
through a combo layer, for dark, plus a second brand the same way, and one
token left ambiguous on purpose (`ring`, for `TST1125`). `check:minimal-ds`
resolves every combination of the five CSS targets' stylesheets through a small
cascade (`scripts/lib/css-cascade.mjs`), by attribute, by OS media feature and
by both mixed, against the stylesheet each exporter writes for that combination
alone: 20580 variable checks. Planning the blocks without putting the target's
own blocks first gave 98 failures, the first being dark + more resolving to the
light `primary.on-tint`. The fixture joined `check:determinism`, and two shapes
(`contrast-motion`, `scheme-brand`) joined the minimal-design-system sweep.

All four examples compile byte-identically to `main`.

## Deviations from the refinements

- Acme does not declare `contrast` and `motion`. Julien's answer on #50 gave
  Acme's demo a few hand-written `more` values; this change keeps every example
  byte-identical instead and puts that ground truth in the fixture, because
  declaring them on Acme moves every Acme coverage number on the site. A
  follow-up can add them to Acme with its demo toggle.
- The #49 refinement proposed a `native` `(mode:brand)` row per exporter
  naming its encoding. Expressed dimensions get no row here, as `color-scheme`
  and css-variables' `density` never had one: a row would move every coverage
  percentage and say nothing the usage file doesn't.
- The #49 refinement also allowed the brand attribute on an ancestor of the
  scheme element (`[data-brand="globex"] [data-color-scheme="dark"]`). The
  planner puts every attribute on the scheme's own element, which keeps one
  specificity per combination size, the property the cascade model rests on;
  the usage files say where to set them.
