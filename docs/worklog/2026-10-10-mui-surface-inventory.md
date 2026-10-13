# MUI's surface inventory

The follow-up the Material UI exporter ([#189](https://github.com/transtyle/transtyle/pull/189),
issue [#71](https://github.com/transtyle/transtyle/issues/71)) left in its spec: MUI shipped
without a checked-in surface inventory, so `check:coverage-bar` did not cover it, and nothing
proved the exporter's rows were the whole of MUI's theming surface. The spec named the method
(extract at runtime from the installed `@mui/material`, the way Mantine's extractor reads
Mantine's defaults, plus the theme leaves that are not variables, flagging each per-component
palette token as a reference or a literal); this entry is that, on Mantine's reconciliation rule.

## What was built

- `packages/exporter-mui/tools/extract-surface.mjs` calls `createTheme()` from the installed
  `@mui/material` (9.5.0, a demo dependency) with the options this exporter uses (CSS-variables
  mode, both colour schemes, the focus ring turned on so its leaves resolve) and writes
  `surface-inventory.json`: 491 entries in Mantine's four families. 387 are the variables
  `generateStyleSheets()` writes, per block (`variables` 49, `light` 155, `dark` 183; 232
  distinct names, where the mapping study counted 231 in 9.4), and 104 are the theme leaves no
  variable carries: the typography variants field by field, transitions, breakpoints,
  `focusVisible` (style, colour, width, offset; its `boxShadow` only wires MUI's private
  variables), `motion.reducedMotion`, and `tonalOffset` and `contrastThreshold` per scheme.
  Nothing is folded. One entry per line, as Chakra's.
- Each entry records `path`, the `ThemeOptions` leaf that sets it, and `from`, measured: each leaf
  is changed in turn in the options, the theme is created again, and the entries that moved
  depend on it. Variables record `kind: "reference" | "literal"`, which is the reference/literal
  flag the spec asked for on the per-component palette tokens (42 references, all of them
  per-component tokens pointing at a palette variable).
- `packages/exporter-mui/src/surface-coverage.js` classifies every entry as set, follows or kept
  on MUI's default through `@transtyle/ir`'s `surfaceStatus()` and `surfaceRows()`, with a
  `REASONS` table matched by id pattern. The exporter records which catalog slot it writes each
  option path from (`mapped`), so an entry left on the default for want of that slot names it.
  The inventory joins the package `files` allowlist.
- `scripts/check-coverage-bar.mjs`: MUI joins `GRAPH_TARGETS`, so it gets the drift guard, the
  per-family arithmetic and the named-row rule with no new code path.
  `gen-catalog-signals.mjs` skips its family rows, `check-doc-numbers.mjs` reads
  `<example>.mui.<set|follow|default>` and gains `<target>.surface.variables|theme`.
- Two new `meaning` keys, both open and single-source: `focus.ring-composite` (the ring's style,
  width and offset, beside #167) and `type.text-transform` (the uppercase button and overline).
  The icon colour (`action.active`, the dark scheme's `text.icon`) got no key: proposal 0005
  binds icon colours to the text ladder, so those entries are `dropped` against it. `color.named-palette`,
  `scale.extra-rung` and `target.config` name MUI's entries too. The report's single
  `colorSchemes.*.opacity.*` row is gone: the eight opacity variables have their own rows now.

## Findings

- **Three probing traps.** MUI's shipped palette colours are literal ramps, but one passed in the
  options gets its missing shades computed from `main`, and MUI refuses one without `main`; a
  first pass probing `primary.contrastText` alone therefore "moved" `light` and `dark`, and
  recorded every shade as reading every other. A probe of one shade now passes MUI's other
  shades as they are. Contrast text is picked by luminance, so one probe colour can land on the
  same white as the default and hide the dependency (`Alert-infoFilledColor` on `info.main`):
  colour leaves are probed twice, dark and light. And `typography.fontSize` reaches
  `--mui-font-h1` only through `typography.h1.fontSize`; a dependency that reaches an entry
  through another settable leaf is probed again with that leaf pinned and dropped if the entry
  stays put, so `from` is what an entry reads directly.
- **The follow count is MUI's own derivation.** 119 entries follow on Acme: 60 `*Channel`
  variables, the 13 typography shorthands, the 36 Slider, LinearProgress and Switch tones MUI
  lightens from each role's `main` in both schemes, and in each scheme the Snackbar it inverts
  from `background.default`, the speed dial's hover, the Skeleton, and the dark AppBar. None needed a mapping.
- **Letter spacing never reaches MUI.** No example's type roles carry a `letterSpacing`, so MUI's
  Roboto tracking (`h1` −0.01562em to `overline` 0.08333em) stays on all thirteen variants.
  Reported per variant against its type role, with no meaning: it is the design systems', not a
  catalog gap. Writing `semantic.type.tracking.normal` where a role has no tracking would change
  every MUI demo's text; it is left as a decision.
- **The outlined input's border is MUI's.** MUI draws it, the input underline, the switch track
  and ButtonGroup's dividers from `common.onBackground` at a fixed alpha, so neither the design
  system's field border nor its base border (on `divider`) reaches them. Reported `dropped`
  against `semantic.color.border.field`; a `MuiOutlinedInput` override or an `onBackground`
  mapping is a follow-up.
- **The tooltip's background is a palette key.** In CSS-variables mode MUI's tooltip reads
  `palette.Tooltip.bg` (a grey 700 at 92% in both schemes), so the catalog's `inverse.surface`
  could reach it; its text is `common.white`, which other components share. Reported `dropped`
  against `semantic.color.inverse.surface`, and the exporter's `(inverse pair)` note, which said
  the colour was not a palette key, now says what MUI reads. Writing it is a follow-up.
- **`motion.reducedMotion` is new in 9.5.** MUI can now turn its transitions off under
  `prefers-reduced-motion` (`'system'`); the exporter's `motion` dimension note says it cannot.
  The leaf is reported as a behaviour switch; the note on the `(mode:motion)` row is a
  follow-up, not changed here.

## Measured

| Example | Report rows | Set | Follow | MUI's default |
| ------- | ----------- | --- | ------ | ------------- |
| Acme    | 303         | 240 | 119    | 132           |
| Cathode | 309         | 240 | 119    | 132           |
| GOV.UK  | 438         | 160 | 65     | 266           |
| Carbon  | 305         | 240 | 119    | 132           |

The emitted `theme.transtyle.ts` is byte-identical before and after on all four examples; only the
coverage line of `usage.md` moves. GOV.UK's extra defaults are the dark entries the others set or
derive, under one reason (no dark scheme, so MUI writes no dark block); the dark entries on MUI's
default elsewhere keep their own reasons, so catalog signals reads the same on all four.

The check was broken on purpose three ways and restored: an entry removed from the inventory (the
drift guard names it and every example's `light` count no longer matches), the recorded version
set to 9.4.0 (the guard names both versions), and the reason for `theme.motion.reducedMotion`
removed (every example fails with the entry's id and where to add the reason).

## Rebased onto the border ladder

The branch was rebased onto proposal 0005 (the border ladder and the inverse pair, #214), which
landed after it was written. The surface counts did not move; the report gained main's two rows
for the border ladder and the inverse pair. Three reasons changed: `common.onBackground`
is now dropped against `border.field`, the icon colour against the text ladder instead of a
`color.icon` key of its own, and `Tooltip-bg` against `inverse.surface`.

## Deviations from the spec's plan

- **The focus ring is listed turned on.** `focusVisible` is opt-in and absent from MUI's default
  theme; its four leaves are listed as MUI resolves them with `focusVisible: true`, which is how
  this exporter's themes always have it.
- **Two palette parameters are theme entries.** The plan named transitions, breakpoints,
  typography and `focusVisible`; `tonalOffset` and `contrastThreshold` are added because MUI
  computes shades and contrast text from them, and a theme that set `main` alone would follow
  them.
