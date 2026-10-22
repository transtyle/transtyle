---
title: 'Material UI exporter'
description: 'A Material UI v9 createTheme in CSS-variables mode: every role a palette key in both colour schemes, type-checked against MUI.'
order: 18
---

# Material UI exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/mui/">Acme</a> · <a href="/demo/cathode/mui/">Cathode</a> · <a href="/demo/govuk/mui/">GOV.UK</a> · <a href="/demo/carbon/mui/">Carbon</a>. One page, four design systems, compiled to Material UI. <a href="/demo/">All 44 demos →</a></p>
</div>

[Material UI](https://mui.com/material-ui/) themes through one `createTheme()` call. In CSS-variables mode it writes every palette colour of every colour scheme as a custom property, and its components read those properties, so switching schemes swaps variables instead of rebuilding the theme. This exporter emits one TypeScript module, `theme.transtyle.ts`, with two exports: `themeOptions`, a plain `ThemeOptions` object with no function in it, and `theme`, MUI's own `createTheme(themeOptions)`.

<!-- measured: acme.mui.rows = 305 -->
<!-- measured: acme.mui.native = 95 -->

On [Acme](/docs/examples/) that is 305 classified rows in `report.json`, 95 of them native, measured against [MUI's whole theming surface](#measured-against-muis-whole-surface).

```json
"targets": { "mui": { "output": "dist/mui" } }
```

```tsx
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme.transtyle';

<ThemeProvider theme={theme}>
  <CssBaseline />
  <App />
</ThemeProvider>;
```

Every role is then a palette key: `<Button color="primary">`, `<Chip color="success">`, and the design system's `danger` is MUI's `error`. Roles MUI has no name for (`accent`, `neutral`, [Cathode](/demo/cathode/mui/)'s `crt-amber`) are extra keys, and the module declares them for TypeScript itself, so `<Button color="accent">` type-checks with no setup. MUI's own `useColorScheme()` switches between the light and dark values.

## Colours

Each role fills MUI's four palette shades in both schemes:

| MUI key        | Grid cell     | Note                                                                                           |
| -------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `main`         | `solid`       |                                                                                                |
| `dark`         | `solid-hover` | **false friend:** a shade, not the dark scheme; a contained button paints it on hover          |
| `light`        | `outline`     | **false friend:** a shade, not the light scheme; only the outlined Alert reads it, as a border |
| `contrastText` | `on-solid`    |                                                                                                |

MUI paints text and outlined buttons with `main` and derives their border and hover washes from it with an alpha. The exporter adds the grid's `text`, `tint`, `outline` and `outline-hover` cells under `palette.<role>.transtyle`. It points Button's own variables at them through theme variants, so an outlined button wears the role's outline and its AA-safe text colour. The four Alert severities read their roles' tint, on-tint, solid and on-solid.

Every colour is written as hex: `createTheme` refuses `oklch()`, because it computes a channel variable from each palette colour. A colour outside sRGB is clamped and reported.

## Surfaces, elevation and focus

`background.default` and `background.paper` are elevation levels 0 and 1. MUI lifts a Paper (Card, Menu, Dialog) by painting an overlay over it. The exporter fills those 25 overlays per scheme with flat gradients of the design system's surfaces, so a dark Dialog shows elevation level 3, not MUI's white veil. The four elevation shadows spread over MUI's 24 by rank, and each one follows the colour scheme.

The design system's focus ring turns on MUI's opt-in keyboard ring (`focusVisible`) for every focusable component, in the ring colour: [GOV.UK](/demo/govuk/mui/)'s yellow ring on its blue buttons is the proof. The Dialog backdrop takes the design system's `scrim`.

## Component geometry

MUI's components already take `shape.borderRadius`, mapped to the control radius, and their own per-variant paddings. So the [component tier](/docs/language/#the-component-tier) reaches a style override only when the design system authored something there. [Acme](/demo/acme/mui/) authors its button layer, so its buttons are pills with its own padding while its inputs keep the control radius; the other examples author none, and MUI keeps its proportions. An authored `component.tooltip.max-width` sets the tooltip's measure, and Paper takes the container radius.

## What MUI has no slot for

- **Pressed and selected colours.** MUI shows a ripple on press, and selection reads `action.selected`.
- **Link colours.** MUI's Link follows the palette colour it's given.
- **Elevation surfaces 4 and 5, three of the six text rungs, the categorical palette, border widths, control heights, density.** No matching slot; each is a `dropped` row with its reason.

## Measured against MUI's whole surface

<!-- measured: mui.surface.total = 491 -->
<!-- measured: acme.mui.set = 240 -->
<!-- measured: acme.mui.follow = 119 -->
<!-- measured: acme.mui.default = 132 -->

The rows above say what the exporter maps. A checked-in inventory says what there is to map: 491 entries extracted from the installed `@mui/material` by calling `createTheme()` the way this exporter does. They cover every CSS variable of its three style-sheet blocks and every theme leaf no variable carries (the typography variants field by field, the transitions, the breakpoints, the focus ring). On Acme, this theme sets 240 entries. MUI derives 119 more from those (every channel variable, the typography shorthands, the Slider and Switch tracks it lightens from each role's colour). The other 132 keep MUI's value, each on its own row in `report.json` with the reason: MUI's grey ramp and the components that read it (Avatar, Chip, AppBar), its translucent state veils, constants such as the uppercase button. Two of them matter to a user. No example's type roles carry a letter spacing, so MUI's Roboto tracking stays on every variant. And MUI draws the outlined input's border from its own black or white at a fixed alpha, so the design system's field border doesn't reach it. The [coverage bar](/docs/concepts/#5-provenance-and-coverage) fails the build when an entry is unaccounted for or kept without a reason.

The full mapping is in the [exporter spec](https://github.com/transtyle/transtyle/blob/main/docs/specs/exporters/mui.md). See it running on real MUI components: `npm run dev -w acme-demo-mui` (or `cathode-demo-mui`) in the [examples](/docs/examples/). The demo's build type-checks the emitted options against MUI's own `ThemeOptions` before bundling them.

## Descriptions and deprecations

A property that maps exactly one slot carries that slot's `description` and `deprecated` as a `/** … */` JSDoc block above it (`Documented` and `jsdocComment()` from `@transtyle/ir`). The description shows on hover, and `@deprecated <reason>` strikes the property through in an editor. That covers the palette keys of the `light` colour scheme (the `dark` one maps the same slots and doesn't repeat them), the font family and weights, `shape.borderRadius`, `spacing`, the transition durations and easings, and `zIndex`. The overlays, shadows, type variants and component overrides read several slots and get none.

## Contrast, motion and brand

[`brand`](/docs/configuration/#contrast-motion-and-brand) gives one theme file per brand, `theme.transtyle.acme.ts` and `theme.transtyle.globex.ts`: hand the brand's theme to `ThemeProvider`. `contrast` and `motion` are reported `dropped` with their reasons: no contrast scheme is emitted yet, and MUI's transition durations are one set per theme.
