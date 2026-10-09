# Exporter spec: Mantine

> **Status: implemented** (`@transtyle/exporter-mantine`). Targets Mantine 9 (`@mantine/core` ≥ 9.0; checked against 9.7.1). First of the exporters scheduled after the reference set, in the order Mantine, Chakra, MUI ([backlog](../../backlog.md) BL-07). The mapping study is on [issue #72](https://github.com/transtyle/transtyle/issues/72), checked against Mantine's own source.

**Why it is worth a target:** Mantine is a CSS-variable-driven React library with a small, fully documented theme object. It names colours by tuple (`colors.<name>` is ten shades), picks the filled shade per scheme (`primaryShade`), and lets any named colour stand for a different tuple in each scheme (`virtualColor`). That is the role grid in another shape, so the exporter is a mapping table plus a cascade finding, not a new technique.

## Emitted artifacts

| File                 | Purpose                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme.transtyle.ts` | `export const theme = createTheme({ … })` and `export const cssVariablesResolver`, both for `<MantineProvider>`; imports `createTheme` and `virtualColor` only |
| `usage.md`           | Provider wiring, why there is no override stylesheet, how the colours map                                                                                      |

The module imports from `@mantine/core`, the framework the output is for, exactly as PrimeNG's `preset.transtyle.ts` imports `definePreset`. The exporter package itself stays zero-dependency.

## The cascade finding: a resolver, not a stylesheet

Mantine writes its CSS variables **at runtime**: `MantineProvider` renders a `<style data-mantine-styles>` inside the React tree, under `:root` and `:root[data-mantine-color-scheme="dark"]`. A `--mantine-*` override stylesheet loaded from `<head>` loses that cascade for every variable Mantine writes itself, on specificity (`[data-mantine-color-scheme="dark"]` against `:root[…]`) and then on source order. The supported route is the provider's `cssVariablesResolver` prop: its `{ variables, light, dark }` result is merged over Mantine's defaults, so it always wins. The exporter therefore emits no stylesheet at all.

## Colours

### One virtual colour per role

Every role with a `solid` cell (the eight catalog roles plus any custom archetype role, e.g. Cathode's `crt-amber`) becomes `virtualColor({ name: <role>, light: '<role>-light', dark: '<role>-dark' })` over two ten-step tuples. The same index is the same grid cell in both schemes:

| Index | 0      | 1            | 2             | 3         | 4               | 5       | 6             | 7              | 8      | 9             |
| ----- | ------ | ------------ | ------------- | --------- | --------------- | ------- | ------------- | -------------- | ------ | ------------- |
| Cell  | `tint` | `tint-hover` | `tint-active` | `outline` | `outline-hover` | `solid` | `solid-hover` | `solid-active` | `text` | `text-strong` |

All ten are direct cells (`native`); PrimeNG's eleven-step projection has one mixed step, this one has none. `primaryShade` is `{ light: 5, dark: 5 }`, so Mantine's own `filled-hover` (shade + 1) is already `solid-hover`. The tuple is not always monotonic in lightness (Cathode's light `text-strong` is lighter than its `solid-active`); that is harmless because components read the variant variables below, not the indices.

A design system with no dark scheme (GOV.UK) gets the light tuple only, and each virtual colour points at it in both schemes; the `usage.md` it gets forces the provider to light.

Tuples are written in hex: Mantine's colour functions (`darken`, `alpha`, luminance for `autoContrast`) parse them in JavaScript and do not read `oklch()`. Everything the resolver writes is CSS and keeps the IR's `oklch()`, alpha included. A cell outside the sRGB gamut is clipped in the tuple and the role's tuple row is `approximated`.

### Per-colour variables (resolver, per scheme)

Mantine's components do not read tuple indices; its variant resolver uses per-colour variables. The resolver sets each one per scheme from that scheme's grid:

| Mantine variable                   | Used for                               | Cell               | Class        | Notes                                                                                                      |
| ---------------------------------- | -------------------------------------- | ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `--mantine-color-<role>-filled`    | filled background                      | `solid`            | native       |                                                                                                            |
| `-filled-hover`                    | filled hover                           | `solid-hover`      | native       |                                                                                                            |
| `-contrast`                        | filled text (with `autoContrast`)      | `on-solid`         | native       | `autoContrast: true` is emitted; for a virtual colour Mantine then reads this variable                     |
| `-light`                           | light background                       | `tint`             | native       |                                                                                                            |
| `-light-hover`                     | light and subtle hover                 | `tint-hover`       | native       |                                                                                                            |
| `-light-color`                     | text of the light, subtle, transparent | `on-tint`          | approximated | one Mantine variable for text on the tint and on the page                                                  |
| `-outline`                         | outline variant's border **and** label | `text`             | approximated | the catalog's `outline` is a border colour (too light for text); Mantine's own default is the filled shade |
| `-outline-hover`                   | outline variant's hover **background** | `tint`             | approximated | false friend: the catalog's `outline-hover` is a hovered border                                            |
| `-text`                            | `c="<role>"`                           | `text`             | native       |                                                                                                            |
| `--mantine-primary-color-contrast` | the primary colour's filled text       | `primary.on-solid` | native       | `--mantine-primary-color-*` otherwise follow by reference                                                  |

### Page and neutrals

| Mantine                                                                             | Catalog                                                                                                                                                                                                      | Class                              | Notes                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mantine-color-body` / `-text` / `-bright` / `-dimmed` / `-placeholder`           | `elevation.0.surface` / `text.base` / `text.strong` / `text.muted` / `text.subtle`                                                                                                                           | native                             |                                                                                                                                                                                                       |
| `--mantine-color-anchor`                                                            | `link.base`                                                                                                                                                                                                  | native                             | `link.hover`, `link.visited`: no slot, dropped                                                                                                                                                        |
| `--mantine-color-error` / `-success`                                                | `danger.text` / `success.text`                                                                                                                                                                               | native                             |                                                                                                                                                                                                       |
| `--mantine-color-default` / `-default-hover` / `-default-color` / `-default-border` | `elevation.1.surface` / `neutral.tint-hover` / `text.base` / `border.base`                                                                                                                                   | native                             | the `default` variant                                                                                                                                                                                 |
| `--mantine-color-disabled` / `-disabled-color` / `-disabled-border`                 | `neutral.tint-active` / `text.disabled` / `border.base`                                                                                                                                                      | approximated, native, approximated | no disabled-surface or disabled-border rung                                                                                                                                                           |
| `--mantine-color-white` (light scheme only)                                         | `elevation.1.surface`                                                                                                                                                                                        | approximated                       | Mantine's light scheme paints raised surfaces (Card, inputs, popovers) white, where dark reads `dark-6`; white is also the checkbox tick, so the raised surface wins in light and white stays in dark |
| `colors.gray` (light)                                                               | 0 `neutral.tint`, 1 `tint-hover`, 2 `tint-active`, 3 `outline`, 4 `border.base`, 5 `text.subtle`, 6 `text.muted`, 7 `neutral.solid-hover`, 8 `text.base`, 9 `text.strong`                                    | native                             | indices where Mantine's own page variables read the tuple; its stylesheet reads `gray-N` and `dark-N` directly hundreds of times                                                                      |
| `colors.dark` (dark)                                                                | 0 `text.base`, 1 mix(`text.base`, `text.muted`), 2 `text.muted`, 3 `text.subtle`, 4 `border.base`, 5 `neutral.tint-hover`, 6 `elevation.1.surface`, 7 `elevation.0.surface`, 8–9 the page mixed toward black | 1, 8, 9 approximated               | the grid has nothing darker than `elevation.0`                                                                                                                                                        |

### Focus ring: dropped

Mantine draws every focus outline (`.mantine-focus-*` and a dozen component rules) as `2px solid var(--mantine-primary-color-filled)` in its stylesheet: the primary `solid`. There is no ring variable to set; `focusClassName` would replace the global class but not the component rules. `semantic.color.ring` is reported `dropped`.

## Typography and scales

| Mantine                                               | Catalog                                                      | Class                  | Notes                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fontFamily`, `fontFamilyMonospace`                   | `font.sans`, `font.mono`                                     | native                 |                                                                                                                                     |
| `headings.fontFamily`, `headings.fontWeight`          | `font.display`, else `type.role.heading.lg`                  | native                 |                                                                                                                                     |
| `headings.sizes.h1…h6`                                | `type.role.heading.{lg,md,sm}`, `type.role.title.{lg,md,sm}` | native                 | `type.role.display.*` has no slot: dropped                                                                                          |
| `fontSizes.{xs…xl}`                                   | `type.size.{xs…xl}`                                          | native                 |                                                                                                                                     |
| `lineHeights.{xs…xl}`                                 | `type.leading.{tight,tight,normal,loose,loose}`              | sm and lg approximated | three rungs for five sizes; `--mantine-line-height` is `md`, `leading.normal`                                                       |
| `fontWeights.{regular,medium,bold}`                   | `type.weight.*`                                              | native                 | `semibold` has no key                                                                                                               |
| `radius.{xs…xl}`, `defaultRadius`                     | xs: half of `radius.sm`; sm–xl by key; `radius.control`      | xs approximated        |                                                                                                                                     |
| `spacing.{xs…xl}`                                     | `space.2`, `space.3`, `space.4`, `space.5`, `space.8`        | xs approximated        | where the unauthored catalog lands on Mantine's own 12/16/20/32px; Mantine's xs is 10px, `space.2` 8px                              |
| `shadows.{xs…xl}`                                     | `elevation.1…4.shadow`                                       | xl approximated        | xl repeats lg                                                                                                                       |
| `breakpoints.{xs…xl}`                                 | `breakpoint.{xs…xl}`, converted to em                        | native                 | Mantine writes its media queries in em; `2xl` dropped                                                                               |
| z-index                                               | `z.*`                                                        | dropped                | Mantine components take z-index from `getDefaultZIndex()` in JS; the `--mantine-z-index-*` variables are not read by its stylesheet |
| motion, `scrim`, `text.inverse`, `opacity.disabled`   | —                                                            | dropped                | transitions are per-component props; the overlay colour is a prop                                                                   |
| `border.{subtle,strong,field}`                        | —                                                            | dropped                | one border variable, `--mantine-color-default-border` (`border.base`); inputs read gray step 4, filled from `border.base`           |
| `inverse.{surface,text}`                              | —                                                            | dropped                | the Tooltip paints fixed tuple steps (gray-9 on white, gray-2 on black); `--tooltip-bg` is per instance, not a theme variable       |
| `density` (and any mode dimension but `color-scheme`) | —                                                            | dropped                | `droppedDimensions(…, ['color-scheme'])`; Mantine's `scale` multiplies every rem, it is not a density switch                        |

## Component tier

Mantine's per-component `vars` are resolver **functions** (`(theme, props) => …`), so the data-only routes are `defaultProps` and `styles`. Theme `styles` apply before the component's own `vars` output, so they cannot replace `--button-padding-x`, but they can set the size-specific variables it points to, which live on the component's root class.

| Catalog                                                     | Mantine                                                                | Class        | Notes                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `component.button.radius`                                   | `components.Button.defaultProps.radius`                                | native       |                                                                                                     |
| `component.control.radius`                                  | `components.Input.defaultProps.radius`                                 | native       |                                                                                                     |
| `component.button.padding-x`                                | `components.Button.styles.root['--button-padding-x-sm']`               | native       | Mantine's default button size; other sizes keep their padding                                       |
| `size.control.{sm,md,lg}`                                   | `--button-height-{xs,sm,md}`, `--input-height-{xs,sm,md}` (same route) | native       | default size to default size: the catalog's `md` is Mantine's `sm`; Mantine's `lg`/`xl` keep theirs |
| `component.control.padding-*`, `component.button.padding-y` | —                                                                      | dropped      | inputs and buttons are height-driven: input padding is a third of the height, no vertical padding   |
| `radius.container`                                          | `components.Card.defaultProps.radius`                                  | native       |                                                                                                     |
| `component.tooltip.max-width` (only when authored)          | `components.Tooltip.styles.tooltip.maxWidth`                           | approximated | a Mantine tooltip only wraps when `multiline`                                                       |

## Measured against Mantine's whole surface

Like Bootstrap and PrimeNG, Mantine carries a checked-in surface inventory, `packages/exporter-mantine/surface-inventory.json`, that `check:coverage-bar` reconciles against every report.

<!-- measured: mantine.surface.total = 203 -->
<!-- measured: mantine.surface.families = 4 -->

**What it holds.** `tools/extract-surface.mjs` reads the installed `@mantine/core` (a demo dependency, never a package dependency) and writes 203 entries in 4 families: `theme`, every leaf of `DEFAULT_THEME` minus functions (`variantColorResolver`) and the open `components` / `other` maps, a colour tuple counting as one leaf; and `variables`, `light`, `dark`, every variable `defaultCssVariablesResolver(DEFAULT_THEME)` writes, per block. The palettes are folded so the inventory does not grow with Mantine's default palettes: `--mantine-color-red-filled` … `-orange-filled` are one entry, `--mantine-color-<color>-filled`, and `colors.pink` … `colors.orange` are `colors.<color>`. A palette stays named when Mantine's own resolver reads it for something other than its own variables: `gray` and `dark` for the page, `red` for `--mantine-color-error`, `teal` for `--mantine-color-success`. That list is found by the extractor, not written by hand; folding those four would let "this theme sets some palettes" stand for "it sets the one the page reads". The per-component CSS-module variables (`--button-*`, `--input-*`, …) are not in the inventory: they are computed by each component's `vars` function, not by the theme, and the component tier reaches the few it can through `styles` (above).

**How an entry depends on the theme.** Each variable records `from`, what its value is computed from, the Mantine counterpart of PrimeNG's `{ref}`. It is measured, not read from Mantine's source: the extractor changes one theme leaf at a time on a copy of `DEFAULT_THEME`, re-runs the resolver, and records which variables moved; it adds the `var(--…)` each value references (`--mantine-color-dimmed` is `var(--mantine-color-gray-6)`), except a reference the theme value itself carries (`fontSizes.xs` is `calc(0.75rem * var(--mantine-scale))`, which a theme replaces whole). The resolver is a pure function, so the extraction is deterministic.

**Classification** (`src/surface-coverage.js`, shared by the exporter and the check; the three-way walk and the report rows are `@transtyle/ir`'s `surfaceStatus()` and `surfaceRows()`, which Chakra's inventory uses too). An entry is **set** when the emitted `createTheme()` object has the leaf or the emitted resolver writes the variable; it **follows** when it is not written but everything in its `from` is set or follows, so Mantine derives it from this theme (`--mantine-font-size-xs` from `fontSizes.xs`); otherwise it keeps **Mantine's default**, and each of those has a reason in the module's `REASONS` table. An `unsupported` reason also names its catalog-signals `meaning` (`target.config`, `color.named-palette`, `color.gradient`, `type.text-wrap`). A design system with no dark scheme (GOV.UK) has one shared reason for the dark block and everything that reads it. An entry the exporter maps but the design system gives it nothing to map from (a minimal one with no type scale) gets a catch-all reason, so a user's report never has a silent row; the check refuses that catch-all on the four examples, which author everything the exporter maps, so an entry new in a Mantine upgrade still needs a reason of its own.

**The reconciliation rule.** Mantine is neither per-variable like Bootstrap nor per-family like PrimeNG, so it takes from both; Chakra's inventory is reconciled by the same rule. `report.json` has one summary row per family, `theme.* (73 entries)` with `n set · n follow · n on Mantine's default`, whose three counts must add up to the inventory's family size (a missing entry is an arithmetic mismatch, as on PrimeNG); and every entry on Mantine's default has its own row, named by its inventory id, with a note (a gap is named, as on Bootstrap). The check fails when a family row is missing or its counts don't add up, when the number of named rows differs from the default count, when one has no reason of its own, and when a fresh extraction differs from the checked-in file (a Mantine upgrade, or a hand edit); the message names `node packages/exporter-mantine/tools/extract-surface.mjs --write`.

<!-- measured: acme.mantine.set = 106 -->
<!-- measured: acme.mantine.follow = 66 -->
<!-- measured: acme.mantine.default = 31 -->
<!-- measured: cathode.mantine.default = 31 -->
<!-- measured: carbon.mantine.default = 31 -->
<!-- measured: govuk.mantine.set = 80 -->
<!-- measured: govuk.mantine.follow = 63 -->
<!-- measured: govuk.mantine.default = 60 -->

| Example                 | Set | Follow | Mantine's default |
| ----------------------- | --- | ------ | ----------------- |
| Acme, Cathode, Carbon   | 106 | 66     | 31                |
| GOV.UK (no dark scheme) | 80  | 63     | 60                |

The 31 kept on every example are behaviour switches with no design value (`focusRing`, `focusClassName`, `activeClassName`, `respectReducedMotion`, `cursorType`, `fontSmoothing`), slots the catalog has no concept for (`headings.textWrap`, the gradient variant's `defaultGradient`, `luminanceThreshold`, `scale`), Mantine's `white` and `black` (their colours are set through the resolver instead), the `red` and `teal` palettes (the page reads them only for the error and success colours, which are set from `danger.text` and `success.text`), the five z-index variables (not read by Mantine's stylesheet: `dropped`) and each scheme's `--mantine-color-scheme` name. GOV.UK adds its missing dark scheme and `font.mono`.

## Ground-truth testing

`examples/*/demo/mantine/` — a Vite + React 19 app on real `@mantine/core` 9 components, rendering the Nimbus Console. `main.tsx` passes `theme` and `cssVariablesResolver` to `<MantineProvider>` exactly as `usage.md` prescribes; the mode toggle drives `useMantineColorScheme()`. The demo's build runs `tsc --noEmit` first, so the emitted module is type-checked against Mantine's own `MantineThemeOverride` and `CSSVariablesResolver` types on every CI run, the same guarantee the Angular build gives PrimeNG's preset. Cathode's filled buttons are the `autoContrast` proof: they carry the design system's dark `on-solid` text, where Mantine's default would put white on phosphor green.
