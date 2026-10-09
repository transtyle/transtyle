# The Material UI exporter

Issue [#71](https://github.com/transtyle/transtyle/issues/71), the third of the exporters the
maintainer scheduled ahead of the P3 pilot on 2026-10-07 (Mantine, Chakra, then MUI;
[backlog](../backlog.md) BL-07). `@transtyle/exporter-mui` emits one module,
`theme.transtyle.ts`, with a `ThemeOptions` object in CSS-variables mode (`themeOptions`) and the
`createTheme()` call (`theme`) for `<ThemeProvider>`. The mapping study is the Refinement section
on the issue, checked then against `@mui/material@9.4.0`; this work re-checked every claim it
relies on against 9.5.0 (published the same day, and what the demos install) by running
`createTheme` and `generateStyleSheets()` in Node. Spec:
[docs/specs/exporters/mui.md](../specs/exporters/mui.md). Built on the layout the Mantine and
Chakra exporters set the same day ([worklog](2026-10-09-chakra-exporter.md)).

## What the source confirmed, and what it added

The refinement held: `createTheme` throws on `oklch()`, extra palette keys get their variables
and channels at runtime, a namespaced `palette.<key>.transtyle.<cell>` becomes a variable, and
Paper's `--Paper-overlay` reads `overlays[elevation]` in both schemes once they are set. Three
things only showed up once the output met MUI's code, its types and a browser:

- **`shadows` is not per scheme.** `colorSchemes.<scheme>` takes a palette, `opacity` and
  `overlays`, but not shadows, so a dark design system's deeper shadows had nowhere to go. Each
  shadow is written into each scheme's palette (`palette.transtyle.shadow-<n>`) and `shadows[i]`
  is `var(--mui-palette-transtyle-shadow-<n>)`: per-scheme shadows, still with no function.
- **Theme variants beat Button's per-colour rule.** The refinement left open whether a
  `components.MuiButton.variants` entry with `props: { color }` wins over Button's built-in rule
  for the same colour. MUI's styled engine appends theme variants after the component's own, at
  the same specificity, and the hover block is nested the same way, so it does: the outlined and
  text buttons wear the grid's `text` and `outline` cells. Checked in the Acme demo's computed
  styles, not only read from source.
- **The Dialog backdrop, not every Backdrop.** A `MuiBackdrop` root override would also paint the
  invisible backdrops of Menu and Popover (theme overrides come after the component's `invisible`
  variant). The scrim goes to `MuiDialog`'s `backdrop` slot only.

## Choices

- **`shape.borderRadius` ← `radius.control`**, not `radius.md` as the refinement suggested. MUI's
  global radius is read by buttons, inputs, chips, toggle buttons and Paper, and Paper takes
  `radius.container` through its own override, so what is left is the control radius. On all four
  examples the two are equal; they differ only where a design system authors them apart.
- **`light` ← `outline`.** In 9.x only the outlined Alert reads `light` (its border), and the
  exporter replaces the twenty Alert colours MUI derives from it. The outline wash is the meaning
  of that border; a lighter shade of `main` would be a new derivation.
- **Hover washes: `tint`.** Button's text and outlined hovers become the role's `tint`, where MUI
  uses `alpha(main, hoverOpacity)`. Reported `approximated`: the grid's tint is the rest wash of a
  tinted surface, the nearest one to a hover wash over the page.
- **Component tier only when authored**, as for Chakra and for the same reason: MUI's components
  already take `shape.borderRadius` and pad each variant and size themselves, so a defaulted tier
  would only overwrite those. `check:component-tier` gained a section asserting Acme (buttons move,
  inputs don't), Cathode (no override written) and the fixture (tooltip measure reaches
  `MuiTooltip`); it fails with the right messages when the exporter writes the tier
  unconditionally.
- **The focus ring is on.** Setting `focusVisible` turns on MUI's opt-in keyboard ring for every
  focusable component. That changes MUI's default look (a ripple only), and is the point: the
  design system names a ring. GOV.UK's yellow ring on its blue buttons is visible in the demo.
- **Density dropped**, as for every exporter but css-variables.
- **Demo storage key per design system.** MUI's provider remembers the mode in `localStorage`.
  The hosted demos share one origin, so the demo passes `modeStorageKey` built from `ds.label`
  (still a file-identical `main.tsx`), and switching Acme to dark leaves Cathode's dark-native
  default alone.

## Measured

`report.json` rows per example, from a fresh build:

| Example | Rows | native | approximated | dropped | unsupported |
| ------- | ---- | ------ | ------------ | ------- | ----------- |
| Acme    | 165  | 91     | 55           | 18      | 1           |
| Cathode | 171  | 88     | 64           | 18      | 1           |
| GOV.UK  | 162  | 91     | 53           | 17      | 1           |
| Carbon  | 162  | 87     | 57           | 17      | 1           |

Most `approximated` rows are by-rank mappings onto MUI's own ladders: thirteen typography
variants, seven duration names, 24 elevation steps, and each role's `light` and hover wash. The
`dropped` rows are one per role for the state cells MUI has no slot for, plus the link colours,
three text rungs, the categorical palette, border widths, control heights and the deep elevation
surfaces. Acme's extra one is its density dimension and Cathode's its ninth role (`crt-amber`);
GOV.UK authors no monospace face and reports its missing dark scheme instead. The rest of the
`approximated` rows are gamut clamps, reported on each variable as #171 settled for the other
hex writers (`check:gamut-rows` now covers MUI): the derived hover and text cells of the
saturated roles fall outside sRGB in every example (10 rows on Acme, 18 on Cathode).

All four demos build with `tsc --noEmit` before `vite build`, so the emitted options and their
module augmentation type-check against MUI's `ThemeOptions`; breaking a value in the emitted
file (a number where MUI wants a colour string) fails that step. All ten plugin-kit fixtures
were also run through the real `createTheme` and through `tsc`, not only the conformance kit.
Checked in a browser: Acme light and dark (pill buttons next to inputs on the control radius, the
dark Card and Dialog on elevation levels 1 and 3, the Dialog over the scrim), GOV.UK (the yellow
focus ring, light only) and Cathode (starts dark).

## Catalog evidence

- **`opacity.component`, second exporter.** MUI's `opacity` group (`inputPlaceholder`,
  `inputUnderline`, `switchTrackDisabled`, `switchTrack`) is themable and has no catalog slot: one
  `unsupported` row with that meaning. Bootstrap reports the same key, and one of its rows is also
  a placeholder's alpha (`placeholder-opacity-max`); the registry status stays `open` until a
  proposal looks at whether the two are the identical concept.
- **Focus ring composite, still four of five.** MUI's ring reads colour, width, offset and style,
  as Chakra's does ([#167](https://github.com/transtyle/transtyle/issues/167)); this exporter maps
  the colour only.
- **BL-19:** MUI reopens none of the deferred promotions. Its controls are padding-driven with no
  size ladder at all, a fourth shape next to Bootstrap's, PrimeNG's and the height-driven Mantine
  and Chakra.

## Deviations from the issue and its refinement

- **No surface inventory yet**, as for Chakra (Mantine's landed the same afternoon, #173, and is
  the model to follow). The refinement's runtime extraction
  (231 variables in 9.4, plus the non-variable theme leaves, with a reference-or-literal flag per
  component palette token) is left to a follow-up task; the spec and the website roadmap say so.
- **No `palette.grey`.** It waits on the shared ramp projection (#39), which is still open.
- **`<Button color="crt-amber">` is not in the demo.** The Nimbus Console must stay
  file-identical across the four examples (`check:demo-parity`), and only Cathode has that role.
  The extra key is checked by `tsc` through `color="accent"` and `color="neutral"`, which every
  example has, and Cathode's module declares `crt-amber` the same way.

## Counts that moved

Exporters 10 → 11, demos 40 → 44 and publishable packages 14 → 15 on the living surfaces
(README, examples page, docs index, homepage, roadmaps, RELEASING, demo READMEs, the demo-app and
validation specs, the architecture overview). Two stale figures found on the way were corrected:
the demo-app spec's "all 36 projects" `check:demos` sentence, and the examples page's local port
ranges, which still ended at 4107. The dated launch post had already lost its `exporters` and
`demos` markers with Mantine; its text stays as published.
