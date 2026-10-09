# Exporter spec: Material UI

> **Status: implemented** (`@transtyle/exporter-mui`). Targets Material UI v9 (`@mui/material` ≥ 9.0; checked against 9.5.0). Third of the exporters scheduled after the reference set, in the order Mantine, Chakra, MUI ([backlog](../../backlog.md) BL-07). The mapping study is the Refinement section on [issue #71](https://github.com/transtyle/transtyle/issues/71), checked against `createTheme` from the published package run in Node.

**Why it is worth a target:** Material UI is the most installed React component library, and its theme is a single object with a fixed shape: a palette of named colours with four shades each, per-component palette tokens, a 25-step elevation ladder, and per-component style overrides. It is the first target whose built-in colour names (`primary`, `secondary`, `error`, `warning`, `info`, `success`) overlap the catalog's roles almost one for one, and whose shade names (`dark`, `light`) collide with the catalog's mode names, which makes it a direct test of translating meanings rather than names.

## Emitted artifacts

| File                 | Purpose                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme.transtyle.ts` | `export const themeOptions = { … } satisfies ThemeOptions` and `export const theme = createTheme(themeOptions)`, plus the module augmentation for the palette keys it adds; imports from `@mui/material` only |
| `usage.md`           | Provider wiring, the scheme mechanism, how the colours map                                                                                                                                                    |

The module imports from `@mui/material`, the framework the output is for, exactly as Mantine's, Chakra's and PrimeNG's modules import from theirs. The exporter package itself stays zero-dependency.

**Everything is data.** `themeOptions` holds no function (no `theme =>` callback, no `variants` predicate), so `createTheme(themeOptions, yourOptions)` merges the user's own options over it the way MUI documents.

## CSS-variables mode, always

The options set `cssVariables: { colorSchemeSelector: '[data-color-scheme="%s"]' }` and put every colour under `colorSchemes.light` and `colorSchemes.dark`. Three reasons:

- MUI's per-component palette tokens (`palette.Alert.*`, `palette.TableCell.border`) and its per-scheme `overlays` exist only under `colorSchemes` with CSS variables on.
- A scheme switch then swaps the `[data-color-scheme]` attribute (MUI's own `useColorScheme().setMode()`), and every component follows without a new theme object.
- The values the theme points at (Button variants, shadows, the focus ring, the dialog backdrop) can name a palette variable, `var(--mui-palette-…)`, and follow the scheme with no function in the theme.

The selector matches the css-variables exporter's. Schemes are emitted **by mode name**, never from the config's default flag (the css-variables polarity rule): `defaultColorScheme` stays MUI's `light`, and a dark-native design system (Cathode) starts dark through `<ThemeProvider defaultMode="dark">` in app code, as its other demos do. A design system with no dark scheme (GOV.UK) gets `colorSchemes.light` only and one `dropped` row saying so. The variable prefix stays MUI's `mui`; `usage.md` says so, since the theme's own `var()` references depend on it.

## Colours as hex

`createTheme` **throws** on `oklch()` (`MUI: Unsupported oklch(…) color`): it computes a `*Channel` variable from every palette colour and parses only `#hex`, `rgb()`, `hsl()` and `color()`. Every colour therefore goes out through `ctx.formatHex`, with a translucent value as `#rrggbbaa` (which MUI parses, alpha included). A clamp into sRGB, in either scheme, makes that variable's own row `approximated` with the gamut note, as the other hex writers do since [#171](https://github.com/transtyle/transtyle/issues/171); `check:gamut-rows` covers it. MUI's `cssVariables.nativeColor` would accept `oklch()` but needs relative-colour support in the browser and changes MUI's own derivations; it is not used.

## Palette

### One palette key per role

Every role with a `solid` cell (the eight catalog roles plus any custom archetype role, e.g. Cathode's `crt-amber`) becomes `palette.<key>` in each scheme. MUI's six keep their names, with one rename: `danger` → `error`. `accent`, `neutral` and archetype roles are **extra keys**: MUI generates their variables and channels at runtime (`--mui-palette-accent-main`, `…-mainChannel`) and `<Button color="accent">` reads `palette[color]`. TypeScript needs module augmentation for them (`Palette`, `PaletteOptions`, `ButtonPropsColorOverrides`, `ChipPropsColorOverrides`), so the module carries it and app code needs no setup.

| Catalog cell                                                                                                                                             | MUI key                        | Class        | Notes                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solid`                                                                                                                                                  | `main`                         | native       |                                                                                                                                                            |
| `solid-hover`                                                                                                                                            | `dark`                         | native       | **False friend.** A shade of `main`, not the dark scheme. A contained button paints it on hover                                                            |
| `outline`                                                                                                                                                | `light`                        | approximated | **False friend.** A shade, not the light scheme. In 9.x only the outlined Alert reads it (its border); MUI's own Alert colours are replaced below          |
| `on-solid`                                                                                                                                               | `contrastText`                 | native       |                                                                                                                                                            |
| `text`                                                                                                                                                   | `transtyle.text`               | native       | read by Button's text and outlined variants (below), where MUI uses `main`                                                                                 |
| `outline` / `outline-hover`                                                                                                                              | `transtyle.outline` / `-hover` | native       | the outlined Button's border at rest and on hover, where MUI uses `alpha(main, 0.5)` and `main`                                                            |
| `tint`                                                                                                                                                   | `transtyle.tint`               | approximated | the text and outlined Button hover wash, where MUI uses `alpha(main, hoverOpacity)`: the grid's tint is the rest wash of a tinted surface, the nearest one |
| `solid-active`, `solid-selected`, `tint-hover`, `tint-active`, `tint-selected`, `text-hover`, `text-active`, `text-strong`, `on-tint` (non-status roles) | —                              | dropped      | MUI has no slot: a pressed button shows a ripple, selection reads `action.selected`, and there is no strong text rung                                      |

The grid cells MUI has no shade for live under a namespaced key per role, `palette.<key>.transtyle.<cell>`, which MUI turns into `--mui-palette-<key>-transtyle-<cell>`. One theme variant per role on `MuiButton` (`{ props: { color: <key> } }`) then points Button's own variables (`--variant-textColor`, `--variant-outlinedColor`, `--variant-outlinedBorder`, and on hover `--variant-textBg`, `--variant-outlinedBg`, `--variant-outlinedBorder`) at those variables. Theme variants come after the component's built-in per-colour rule at the same specificity, so they win; this was checked in the demo's browser build.

No numbered ramps are emitted, and `palette.grey` stays MUI's. It feeds a handful of defaults (`Tooltip.bg`, `Avatar`, `Chip`'s default border, `AppBar`'s default colour, `Switch`'s disabled thumb) and would need the neutral ramp projected to MUI's ten steps per scheme: the shared projection of [#39](https://github.com/transtyle/transtyle/issues/39), still open.

### Status colours: the Alert

| MUI token                                          | Catalog                            | Class  | Notes                                                                          |
| -------------------------------------------------- | ---------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `palette.Alert.<severity>Color`                    | `<role>.on-tint`                   | native | the standard and outlined Alert text, on the tint                              |
| `palette.Alert.<severity>StandardBg`               | `<role>.tint`                      | native |                                                                                |
| `palette.Alert.<severity>IconColor`                | `<role>.solid`                     | native |                                                                                |
| `palette.Alert.<severity>FilledBg` / `FilledColor` | `<role>.solid` / `<role>.on-solid` | native | MUI's dark scheme uses `dark` here; the solid is the same cell in both schemes |

`<severity>` is `error`, `warning`, `info` and `success`, reading `danger`, `warning`, `info` and `success`. MUI derives all twenty from `light` with `darken`/`lighten`; emitting them replaces the derivation with the grid's own cells, so `light` has no other reader.

### Page colours

| MUI                                       | Catalog                                        | Class        | Notes                                                                          |
| ----------------------------------------- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `background.default` / `background.paper` | `elevation.0.surface` / `elevation.1.surface`  | native       | every Paper starts from `paper`; the overlays below lift it per elevation      |
| `text.primary` / `secondary` / `disabled` | `text.base` / `text.muted` / `text.disabled`   | native       | `text.strong`, `subtle` and `inverse` have no MUI rung: dropped                |
| `action.disabled`                         | `text.disabled`                                | native       | the text of a disabled button                                                  |
| `action.disabledOpacity`                  | `opacity.disabled`                             | native       |                                                                                |
| `action.hover` / `action.selected`        | `neutral.tint-hover` / `neutral.tint-selected` | approximated | MUI's are 4% and 8% veils over any surface; the neutral washes are opaque      |
| `divider`, `TableCell.border`             | `border`                                       | native       | `TableCell.border` replaces MUI's lightened divider                            |
| `ring` (extra key)                        | `ring`                                         | native       | read by the focus ring (below)                                                 |
| `transtyle.scrim` (extra key)             | `scrim`                                        | native       | read by `MuiDialog`'s backdrop; Menu and Popover backdrops stay invisible      |
| `link.*`                                  | —                                              | dropped      | MUI's Link reads `palette[color].main`: links follow the colour they are given |
| `palette.categorical.*`, `border-width.*` | —                                              | dropped      | no chart slot; MUI writes `1px` borders literally                              |

## Elevation

| MUI                                        | Catalog                | Class        | Notes                                                                                                                                        |
| ------------------------------------------ | ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `colorSchemes.<scheme>.overlays[0–1]`      | `elevation.1.surface`  | native       | Paper paints `var(--Paper-overlay)` over `background.paper`: `linear-gradient(<surface>, <surface>)` gives the exact surface in both schemes |
| `overlays[2–4]`                            | `elevation.2.surface`  | approximated | by rank: MUI raises AppBar to 4                                                                                                              |
| `overlays[5–24]`                           | `elevation.3.surface`  | approximated | Snackbar 6, Menu and Popover 8, Drawer 16, Dialog 24: all floating layers, which the catalog puts on level 3                                 |
| `elevation.4–5.surface`                    | —                      | dropped      | nothing in MUI sits deeper than a floating layer                                                                                             |
| `shadows[1]`, `[2–4]`, `[5–12]`, `[13–24]` | `elevation.1–4.shadow` | approximated | by rank, four shadows over 24; `shadows[0]` stays `none`                                                                                     |

MUI's `shadows` is not per scheme. Each shadow is therefore written into the palette of each scheme (`palette.transtyle.shadow-<n>`), and `shadows[i]` is `var(--mui-palette-transtyle-shadow-<n>)`: the dark scheme gets its own, deeper shadows with no function in the theme.

## Typography and scales

| Catalog                                                | MUI                                                           | Class                  | Notes                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `font.sans`                                            | `typography.fontFamily`                                       | native                 | `font.mono` has no MUI slot: dropped                                                                                                  |
| `type.weight.regular` / `medium` / `bold`              | `typography.fontWeightRegular` / `Medium` / `Bold`            | native                 |                                                                                                                                       |
| `type.role.display.lg` / `md` / `sm`                   | `typography.h1` / `h2` / `h3`                                 | approximated           | by rank; MUI's own ladder (6rem light `h1`) is replaced by the design system's                                                        |
| `type.role.heading.lg` / `md` / `sm`                   | `typography.h4` / `h5` / `h6`                                 | approximated           |                                                                                                                                       |
| `type.role.title.sm`, `label.lg`                       | `typography.subtitle1`, `subtitle2`                           | approximated           |                                                                                                                                       |
| `type.role.body.md`, `body.sm`                         | `typography.body1`, `body2` (and `caption`)                   | native, approximated   | `body1` is MUI's default text, the catalog's default body                                                                             |
| `type.role.label.md`, `label.sm`                       | `typography.button`, `overline`                               | approximated           | MUI keeps its uppercase `button` and `overline`                                                                                       |
| `radius.control`                                       | `shape.borderRadius`                                          | native                 | MUI rounds buttons, inputs and chips with it, and every Paper (below takes over)                                                      |
| `radius.container`                                     | `components.MuiPaper.styleOverrides.rounded.borderRadius`     | native                 | Card, Menu, Popover, Dialog and Alert are all Paper                                                                                   |
| `space.2`                                              | `spacing`                                                     | native or approximated | `theme.spacing(n)` = `n × space.2`, which is `space.(2n)` on a linear scale (all four examples); a non-linear scale is `approximated` |
| `breakpoint.sm` … `xl`                                 | `breakpoints.values.sm` … `xl`                                | native                 | in px; **false friend:** MUI's `xs` is the mobile-first base and stays `0`, so the catalog's `xs` is dropped; `2xl` is dropped too    |
| `duration.fast` / `normal` / `slow`                    | `transitions.duration.*` (milliseconds)                       | approximated           | `shortest`, `shorter`, `leavingScreen` ← fast; `short`, `standard`, `enteringScreen` ← normal; `complex` ← slow                       |
| `easing.standard` / `enter` / `exit`                   | `transitions.easing.easeInOut` / `easeOut` / `easeIn`         | native                 |                                                                                                                                       |
| `easing.emphasized`                                    | `transitions.easing.sharp`                                    | approximated           | **false friend:** MUI's `sharp` is for elements that may return at any time                                                           |
| `z.sticky` / `overlay` / `modal` / `toast` / `tooltip` | `zIndex.appBar` / `drawer` / `modal` / `snackbar` / `tooltip` | native                 | MUI's `mobileStepper`, `fab` and `speedDial` stay                                                                                     |
| `size.control.*`                                       | —                                                             | dropped                | MUI's buttons and inputs are padding-driven: no size sets a height                                                                    |
| `density` (and any mode dimension but `color-scheme`)  | —                                                             | dropped                | `droppedDimensions(…, ['color-scheme'])`, as for every exporter except css-variables                                                  |

`opacity.inputPlaceholder`, `inputUnderline`, `switchTrackDisabled` and `switchTrack` (per scheme) are themable and have no catalog slot: one `unsupported` row with the `opacity.component` meaning ([catalog signals](../../findings/catalog-signals.md)).

## Focus ring

`semantic.color.ring` → `focusVisible: { outlineColor: 'var(--mui-palette-ring)' }`, with `ring` emitted as a palette key per scheme. MUI 9's `focusVisible` is opt-in: setting it **turns on** MUI's keyboard focus ring (2px solid, 2px offset) on every focusable component, where MUI otherwise shows a ripple. That is deliberate: the design system names a ring, and the ring is the accessible default. GOV.UK (a yellow ring on blue buttons) is the proof in the demo. MUI's ring reads colour, width, offset and style, four of the five fields proposal 0002 deferred for a focus-ring composite ([#167](https://github.com/transtyle/transtyle/issues/167)); the exporter maps the colour only, as Chakra's does.

## Component tier

MUI's components already read `shape.borderRadius` (here `radius.control`) and pad each variant and size themselves (contained `6px 16px`, outlined `5px 15px` to absorb its 1px border, text `6px 8px`). A tier value whose chain is entirely catalog-defaulted would only replace those with catalog defaults, so, as in the Chakra exporter, **a style override is written only when something in the chain is authored**: the token itself (`authored`, or `aliased` by the author), or, for `button.*`, the `control.*` slot it defaults from.

| Catalog                                            | MUI                                                                                                                    | Class        | Notes                                                                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component.button.radius`                          | `MuiButton.styleOverrides.root.borderRadius`                                                                           | native       |                                                                                                                                                                                           |
| `component.button.padding-x` / `-y`                | `MuiButton.variants`: `{ variant: 'contained', size: 'medium' }` and `{ variant: 'outlined', size: 'medium' }` padding | approximated | the outlined one minus its 1px border; text buttons and the small and large sizes keep MUI's                                                                                              |
| `component.control.radius`                         | `MuiOutlinedInput.styleOverrides.root.borderRadius`                                                                    | native       |                                                                                                                                                                                           |
| `component.control.padding-x` / `-y`               | `MuiOutlinedInput.styleOverrides.input.padding`, plus `MuiInputLabel.variants` for the outlined label's two transforms | approximated | MUI places the outlined label with hard-coded transforms (`translate(14px, 16px)`, shrunk `translate(14px, -9px)`), so they move with the padding; the small input takes the same padding |
| `component.tooltip.max-width` (only when authored) | `MuiTooltip.styleOverrides.tooltip.maxWidth`                                                                           | native       | MUI's own ceiling is 300px                                                                                                                                                                |

Acme authors only the button layer, so its buttons are pills with its own padding while its inputs keep `shape.borderRadius`; Cathode, GOV.UK and Carbon author no tier and keep MUI's proportions. `check:component-tier` asserts all three cases and the tooltip measure on its fixture.

## Not yet measured against MUI's whole surface

Bootstrap, PrimeNG and Mantine carry a checked-in surface inventory that `check:coverage-bar` reconciles against every report. MUI's equivalent is a follow-up, as Chakra's is ([#166](https://github.com/transtyle/transtyle/issues/166)): extract it at runtime from the installed `@mui/material`, the way `exporter-mantine/tools/extract-surface.mjs` reads Mantine's defaults ([#173](https://github.com/transtyle/transtyle/pull/173)) (`createTheme({ cssVariables: …, colorSchemes: { light: true, dark: true } }).generateStyleSheets()` lists 231 variables in 9.4), plus the theme leaves that are not variables (`transitions`, `breakpoints`, the typography variants, `focusVisible`), recording for each per-component palette token whether MUI's default is a reference to another palette variable or a literal. `components.*.styleOverrides` is open-ended and stays out of the denominator, apart from the slots in the table above. Until it lands, the rows above are what the report classifies, and nothing proves the list is the whole surface.

## Reserved dimensions: contrast, motion, brand

`theme.transtyle.ts` is emitted once per brand, `theme.transtyle.<brand>.ts` (file-per-value, [ADR-0015](../../adr/0015-mode-combinations.md)): pass the brand's theme to `ThemeProvider`. `contrast` and `motion` are `dropped` with their reasons: MUI's `colorSchemes` could carry a scheme per contrast value, which is not emitted yet, and `transitions.duration` is one set per theme that MUI does not switch on `prefers-reduced-motion`.

## Ground-truth testing

`examples/*/demo/mui/`: a Vite + React 19 app on real `@mui/material` 9 components, rendering the Nimbus Console plus the four Alert severities. `main.tsx` passes `theme` to `<ThemeProvider>` with `<CssBaseline />`, exactly as `usage.md` prescribes; the mode toggle calls `useColorScheme().setMode()`. The demo's build runs `tsc --noEmit` first, so the emitted options and their module augmentation are type-checked against MUI's own `ThemeOptions` on every CI run, the same guarantee the Mantine, Chakra and PrimeNG demos give. Without it, a palette key missing its augmentation would still build.
