# The Chakra UI exporter

Issue [#73](https://github.com/transtyle/transtyle/issues/73), the second of the exporters the
maintainer scheduled ahead of the P3 pilot on 2026-10-07 (Mantine, Chakra, then MUI;
[backlog](../backlog.md) BL-07). `@transtyle/exporter-chakra` emits one module,
`theme.transtyle.ts`, with a `defineConfig()` object and the `createSystem(defaultConfig, config)`
call for `<ChakraProvider>`. The mapping study is the Refinement section on the issue, checked
against `@chakra-ui/react@3.37.0` source; the demos install the same version. Spec:
[docs/specs/exporters/chakra.md](../specs/exporters/chakra.md). Built on the layout the Mantine
exporter set the same day ([worklog](2026-10-09-mantine-exporter.md)).

## What the source confirmed, and what it added

The refinement held: eight palette keys per role (not the seven the issue listed: `border` is the
eighth), recipes that read those keys rather than the ramps, built-in `.dark` conditions, a
deep-merging `createSystem`. Three things only showed up once the output met Chakra's types and a
browser:

- **Slot recipe overrides must name their slots.** `SlotRecipeDefinition` requires `slots`, so a
  partial `slotRecipes.alert` with only its `status` variant fails `tsc`. The module takes the list
  from Chakra's own anatomy (`alertAnatomy.keys()`, from `@chakra-ui/react/anatomy`) rather than a
  copied array, and Chakra's merge (`utils/merge.js`) merges arrays index by index, so the same
  list lands on itself.
- **Two more hard-coded hues.** Besides the Alert's statuses, the checkbox and radio marks set
  `colorPalette: "red"` on `_invalid` (and the radio mark a literal `red.500` border). Both are
  routed to `danger` and `border.error`, the same rule as the Alert: translate the meaning, leave
  Chakra's `red` palette red.
- **`colorPalette` accepts any string in Chakra's types**, so `colorPalette="primary"` type-checks
  without `chakra typegen`, and the demo build can run `tsc --noEmit` like Mantine's.

## Choices

- **Hover cells dropped** (the refinement's recommendation). Chakra computes `solid/90` and reuses
  `muted`/`subtle`; overriding Button's `_hover` would make authored hovers win in one recipe only.
- **No numbered ramps.** No recipe reads them, Chakra's tokens take no conditions, and the shared
  projection (#39) has not landed; the spec says what a ramp would be for.
- **Component tier only when authored.** Chakra's recipes already read `l2` and the spacing scale,
  so a fully defaulted tier would only replace Chakra's per-size proportions with catalog defaults
  (its md input pads `3`, the catalog's default control padding is `space.4`). The exporter checks
  provenance: `authored` or `aliased` on the token, or on the `control.*` slot a `button.*` token
  defaults from. `check:component-tier` gained a section asserting Acme (buttons move, inputs
  don't), Cathode (no recipe touched) and the fixture (tooltip measure reaches the tooltip recipe);
  it fails with the right messages when the exporter emits the tier unconditionally.
- **Control heights always.** `size.control.*` is semantic tier, emitted like every other scale:
  the catalog's `sm`/`md`/`lg` land on Chakra's rungs of the same name, so unauthored Chakra buttons
  are 2.25rem instead of 2.5rem at `md`.
- **Density dropped**, as for every exporter but css-variables. Chakra could express it through a
  custom condition on `semanticTokens.spacing`; that builder belongs with the Panda exporter (#79).

## Measured

`report.json` rows per example, from a fresh build:

| Example | Rows | native | approximated | dropped |
| ------- | ---- | ------ | ------------ | ------- |
| Acme    | 189  | 146    | 27           | 16      |
| Cathode | 195  | 152    | 27           | 16      |
| GOV.UK  | 185  | 143    | 26           | 16      |
| Carbon  | 186  | 145    | 26           | 15      |

Native is high because the palette keys are a rename of the grid; most `approximated` rows are the
by-rank scales (line heights, shadows), the layered radii (`l1`, `l2`) and the neutral washes behind
`bg.subtle`/`muted`/`emphasized`. The `dropped` rows are mostly one per role (the hover, active and
selected cells). Cathode has one more palette (`crt-amber`); GOV.UK's extra `dropped` row is its
missing dark scheme, Acme's the density dimension.

The demo build runs `tsc --noEmit` before `vite build`, so all four emitted configs type-check
against Chakra's `SystemConfig` types. Checked in a browser on Acme (light: pill buttons next to
inputs on the control radius, the tooltip wrapping at Acme's 18rem) and Cathode (dark and its paper light
mode, the dialog over Cathode's scrim, the four Alert statuses on the status roles).

## Catalog evidence

- **Tooltip measure, third witness.** Chakra caps tooltip content at `sizes.xs` (20rem), after
  Bootstrap's and PrimeNG's 200px ([proposal 0004](../proposals/0004-component-geometry.md)).
- **Focus ring composite: the deferral's trigger is met.** Proposal 0002, row 8, deferred a
  five-field focus-ring composite until a second component-heavy exporter needed it. Chakra's
  `focusVisibleRing` reads colour, `--focus-ring-width`, `--focus-ring-offset` and
  `--focus-ring-style` (`preset-base`): four of the five. The catalog decision is filed as
  [#167](https://github.com/transtyle/transtyle/issues/167); this exporter maps the colour only.
- **BL-19:** Chakra reopens none of the deferred promotions; its controls are height-driven, like
  Mantine's.

## Deviations from the issue and its refinement

- **No surface inventory yet**, as for Mantine: the extraction (every token leaf of
  `defaultConfig`, plus recipe leaves resolved through `defaultSystem`) is filed as
  [#166](https://github.com/transtyle/transtyle/issues/166). The spec and the website roadmap say so.
- **The false-friends table** on the language page gains a Chakra column and an `emphasized` row,
  as the refinement asked; proposal 0004 is left as accepted, and the third tooltip witness is
  recorded here and in the spec.

## Counts that moved

Exporters 9 → 10 and demos 36 → 40 on the living surfaces (README, examples page, docs index,
homepage, roadmaps, RELEASING, demo READMEs, the demo-app and validation specs, the architecture
overview). The dated launch post had already lost its `exporters` and `demos` markers with Mantine;
its text stays as published.
