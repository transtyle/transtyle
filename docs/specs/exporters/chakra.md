# Exporter spec: Chakra UI

> **Status: implemented** (`@transtyle/exporter-chakra`). Targets Chakra UI v3 (`@chakra-ui/react` ≥ 3.0; checked against 3.37.0). Second of the exporters scheduled after the reference set, in the order Mantine, Chakra, MUI ([backlog](../../backlog.md) BL-07). The mapping study is the Refinement section on [issue #73](https://github.com/transtyle/transtyle/issues/73), checked against Chakra's own source.

**Why it is worth a target:** Chakra v3 is _semantic-token native_. Every colour palette carries eight semantic keys with a `_light` and a `_dark` value, and its 76 recipes read those keys rather than the numbered ramps. That is the closest any library comes to the role grid, so the exporter is a direct test of the grid's vocabulary, and its recipe system is a third structural family for the component tier ("per component, no shared object"), after Bootstrap's shared Sass roots and PrimeNG's archetype objects.

## Emitted artifacts

| File                 | Purpose                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme.transtyle.ts` | `export const config = defineConfig({ … })` and `export const system = createSystem(defaultConfig, config)`; imports from `@chakra-ui/react` (and its `anatomy` entry) only |
| `usage.md`           | Provider wiring, the scheme mechanism, how the colours map                                                                                                                  |

The module imports from `@chakra-ui/react`, the framework the output is for, exactly as Mantine's and PrimeNG's modules import from theirs. The exporter package itself stays zero-dependency.

## A partial config, merged

`createSystem(defaultConfig, config)` deep-merges a partial config into Chakra's default theme, so the module carries **overrides and additions only**: what the catalog has a meaning for is replaced, what it has none for stays Chakra's. Arrays merge index by index, which matters once (below, slot recipes).

Two rules follow from that:

- **Route Chakra's defaults at roles; never rebind hue names.** Chakra's default palette is `gray` (`globalCss.html.colorPalette`), and several recipes hard-code a hue for a meaning. The exporter points those at the role of the same meaning (table below). Chakra's own hue palettes (`gray`, `red`, `blue`, …) are left alone: `colorPalette="red"` stays red ([translating by meaning, not by name](../../../website/src/docs/language.md)).
- **The component tier writes a recipe value only when something in its chain is authored** (Component tier, below).

A slot recipe override must name its `slots` (Chakra's `SlotRecipeDefinition` type requires them). The module takes them from Chakra's own anatomy (`alertAnatomy.keys()`), never from a copied list, and the index-by-index array merge lands the same list on itself.

## Colours

### One palette per role

Every role with a `solid` cell (the eight catalog roles plus any custom archetype role, e.g. Cathode's `crt-amber`) becomes `semanticTokens.colors.<role>` with Chakra's eight keys. Palettes are an open set in Chakra, so a custom role works with `colorPalette="crt-amber"` like a built-in one. Values are literal per scheme (`{ _light, _dark }`), never references to a ramp.

| Catalog cell                                                                                                   | Chakra key         | Class        | Notes                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solid`                                                                                                        | `solid`            | native       |                                                                                                                                                                        |
| `on-solid`                                                                                                     | `contrast`         | native       |                                                                                                                                                                        |
| `text`                                                                                                         | `fg`               | native       | Chakra also puts `fg` on `subtle` backgrounds, where the catalog has `on-tint`                                                                                         |
| `tint`                                                                                                         | `subtle`           | native       | the lightest wash                                                                                                                                                      |
| `tint-hover`                                                                                                   | `muted`            | native       | **False friend.** A tint depth: the hover of `subtle` and `ghost`, a soft border. Not "muted text" (`text.muted`) and not shadcn's `muted` surface pair                |
| `tint-active`                                                                                                  | `emphasized`       | native       | **False friend.** The deepest tint (`::selection`, Steps' completed state, Date Input and Tags Input highlights). Not "emphasis"                                       |
| `outline`                                                                                                      | `border`           | native       | the outline variant's border, and the `--outline-shadow` of Alert and Badge                                                                                            |
| `semantic.color.ring`                                                                                          | `focusRing` (each) | approximated | the catalog keeps one ring on purpose (proposal 0002, row 8); Chakra wants one per palette and defaults it to the palette's own hue. Every palette gets the one `ring` |
| `solid-hover`, `solid-active`, `solid-selected`, `tint-selected`, `outline-hover`, `text-hover`, `text-active` | —                  | dropped      | Chakra derives its own hovers: the solid button is `colorPalette.solid/90`, the subtle, surface, ghost and outline variants reuse `muted` or `subtle`                  |
| `on-tint`, `text-strong`                                                                                       | —                  | dropped      | Chakra pairs `subtle` with `fg` and has no strong rung                                                                                                                 |

The dropped cells are one row per role in `report.json`. **Decision: the hover cells stay dropped.** The alternative was to emit them as extra palette keys and rewrite `recipes.button.variants.variant.*._hover.bg` to read them: authored hovers would then win in Button only, and every other recipe would still use Chakra's own. That opens a recipe-by-recipe surface nothing else in this exporter needs; the measured loss shows in the report instead.

No `tokens.colors.<role>.{50…950}` ramps are emitted. Chakra's tokens take no conditions, so a ramp is scheme-invariant, and no recipe reads a numbered step except `code-block` and `radiomark`'s invalid border (routed below). A ramp would be idiomatic for app code (`bg="primary.100"`), and is the obvious consumer of the shared projection once [#39](https://github.com/transtyle/transtyle/issues/39) lands.

### Global colours

| Chakra                                                     | Catalog                                                                                           | Class        | Notes                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `bg` (`DEFAULT`), `bg.panel`                               | `elevation.0.surface`, `elevation.1.surface`                                                      | native       | Chakra has two surfaces; `elevation.2–5.surface` are dropped                                       |
| `bg.subtle` / `muted` / `emphasized`                       | `neutral.tint` / `tint-hover` / `tint-active`                                                     | approximated | Chakra's are gray 50 / 100 / 200                                                                   |
| `bg.inverted`                                              | `text.strong`                                                                                     | approximated | no inverted surface in the catalog; Chakra's is near-black in light (tooltips)                     |
| `fg` (`DEFAULT`), `fg.muted`, `fg.subtle`, `fg.inverted`   | `text.base`, `text.muted`, `text.subtle`, `text.inverse`                                          | native       |                                                                                                    |
| `border` (`DEFAULT`)                                       | `border`                                                                                          | native       | also feeds `--global-color-border`                                                                 |
| `border.subtle` / `muted` / `emphasized` / `inverted`      | `neutral.tint` / `neutral.tint-hover` / `neutral.outline` / `text.strong`                         | approximated | Chakra's are gray 50 / 100 / 300 / 800                                                             |
| `bg.<status>`, `fg.<status>`, `border.<status>`            | `<role>.tint`, `<role>.text`, `<role>.solid` for `error` ← `danger`, `warning`, `success`, `info` | native       | `border.error` is also the invalid-field border, as PrimeNG's `invalidBorderColor` is              |
| `scrim` (new) + `dialog` / `drawer` `base.backdrop.bg`     | `scrim`                                                                                           | native       | replaces Chakra's `blackAlpha.500` on both backdrops                                               |
| `link.*`                                                   | —                                                                                                 | dropped      | Chakra's Link reads `colorPalette.fg`: links follow the palette they sit in                        |
| `palette.categorical.*`, `text.disabled`, `border-width.*` | —                                                                                                 | dropped      | no chart slot; disabled is an opacity (below); Chakra's recipes write `borderWidth: 1px` literally |

### Routing: Chakra's defaults read roles

| Chakra default                                                                             | Becomes                                                        | Why                                                                            |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `globalCss.html.colorPalette: "gray"`                                                      | `neutral`                                                      | components without a `colorPalette` prop wear the design system's neutral grid |
| `slotRecipes.alert.variants.status.{info,warning,success,error,neutral}.root.colorPalette` | `info`, `warning`, `success`, `danger`, `neutral`              | Chakra hard-codes blue, orange, green, red and gray                            |
| `recipes.checkmark` and `recipes.radiomark` `base._invalid.colorPalette: "red"`            | `danger` (and `radiomark`'s `red.500` border → `border.error`) | the invalid checkbox and radio read the danger role                            |

Invalid inputs, selects and textareas already read `border.error` and `fg.error`, so they follow the status mapping above with no override.

## Typography and scales

| Catalog                                                | Chakra                                                                                            | Class                                | Notes                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `font.sans` / `display` / `mono`                       | `fonts.body` / `heading` / `mono`                                                                 | native                               | no `display` authored: headings take the sans; `font.serif` → an extra `fonts.serif`                          |
| `type.size.xs` … `4xl`                                 | `fontSizes.xs` … `4xl`                                                                            | native                               | same names; Chakra's `2xs` and `5xl`–`9xl` stay                                                               |
| `type.weight.regular` / `medium` / `semibold` / `bold` | `fontWeights.normal` / `medium` / `semibold` / `bold`                                             | native                               |                                                                                                               |
| `type.leading.tight` / `normal` / `loose`              | `lineHeights.short` / `moderate` / `tall`                                                         | approximated                         | by rank (Chakra has five); Chakra's `textStyles` carry their own line heights, so leading does not reach them |
| `type.tracking.tight` / `normal` / `wide`              | `letterSpacings.tight` / `normal` (new) / `wide`                                                  | native                               |                                                                                                               |
| `type.role.<role>.<size>`                              | `textStyles["<role>.<size>"]`                                                                     | native                               | one row for all: `textStyle="heading.lg"`; Chakra's size-named styles stay                                    |
| `radius.none`, `sm`, `md`, `lg`, `xl`, `full`          | `radii.*` (same names)                                                                            | native                               | Chakra's `2xs`, `xs`, `2xl`–`4xl` stay                                                                        |
| `radius.sm` / `control` / `container`                  | semantic `radii.l1` / `l2` / `l3`                                                                 | approximated / approximated / native | `l1` rounds inner items, `l2` controls and also badges, tooltips and toasts, `l3` containers                  |
| `space.<k>`                                            | `spacing.<k>`                                                                                     | native                               | same meaning (`k × 0.25rem` unauthored); Chakra's half steps and steps above 24 stay                          |
| `size.control.sm` / `md` / `lg`                        | `h` and `minW` of `recipes.button`, `--input-height` of `recipes.input`, sizes `sm` / `md` / `lg` | native                               | same rung names; Chakra's `2xs`, `xs`, `xl`, `2xl` keep their heights                                         |
| `duration.fast` / `normal` / `slow` / `slower`         | `durations.fast` / `moderate` / `slow` / `slower`                                                 | native                               | `instant` → `fastest`, approximated                                                                           |
| `easing.standard` / `enter` / `exit`                   | `easings.ease-in-out` / `ease-out` / `ease-in`                                                    | native                               | `emphasized` and `spring` → extra keys                                                                        |
| `z.*`                                                  | `zIndex.*`                                                                                        | native                               | all ten catalog names exist in Chakra, in the same order (plus `docked`, `skipNav`, `max`)                    |
| `breakpoint.sm` … `2xl`                                | `breakpoints.sm` … `2xl`                                                                          | native                               | `xs` has no Chakra key (`base` is 0): dropped                                                                 |
| `elevation.1–4.shadow`                                 | semantic `shadows.sm` / `md` / `lg` / `xl`                                                        | approximated                         | by rank, `_light` / `_dark`; `xs`, `2xl`, `inner`, `inset` stay Chakra's                                      |
| `opacity.disabled`                                     | `layerStyles.disabled.value.opacity`                                                              | native                               | every Chakra control reads the disabled layer style: a third library with exactly this meaning                |
| `density` (and any mode dimension but `color-scheme`)  | —                                                                                                 | dropped                              | `droppedDimensions(…, ['color-scheme'])` (below)                                                              |

## Modes

- **Colour scheme.** Chakra's own conditions: `_light` is `:root &, .light &` and `_dark` is `.dark &, .dark .chakra-theme:not(.light) &`. Every semantic token carries `{ _light, _dark }` from the light and the dark mode, by mode name, never by the config's default flag (the css-variables polarity rule). A `.dark` class on `<html>` switches every role; no custom condition and no `next-themes` are needed. A design system with no dark scheme (GOV.UK) gets one value per token and a `dropped` row saying so.
- **Density: dropped.** Chakra accepts custom `conditions`, and its recipes read `spacing`, so `semanticTokens.spacing` under a `[data-density="compact"] &` condition could make every component compact. That is the same choice the Panda exporter faces ([#79](https://github.com/transtyle/transtyle/issues/79)), and both should share the builder; until then the dimension is reported `dropped`, like every exporter except css-variables.

## Component tier

Chakra's recipes already read the semantic routes: `borderRadius: "l2"` (`radius.control`) and the `spacing` scale (`px: "4"` on the md button is the catalog's `space.4`, which is `component.control.padding-x`'s own default). So a tier value whose chain is entirely catalog-defaulted would only overwrite Chakra's per-size proportions (its md input is `px: 3`) with catalog defaults. **The exporter writes a tier value only when something in its chain is authored**: the token itself (`authored`, or `aliased` by the author), or, for `button.*`, the `control.*` slot it defaults from.

| Catalog                                            | Chakra                                                                  | Class        | Notes                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `component.button.radius`                          | `recipes.button.base.borderRadius`                                      | native       |                                                                                |
| `component.button.padding-x`                       | `recipes.button.variants.size.md.px`                                    | approximated | Chakra pads each size; the tier has one value, so it lands on the default size |
| `component.control.radius`                         | `recipes.input.base.borderRadius`, `recipes.textarea.base.borderRadius` | native       |                                                                                |
| `component.control.padding-x`                      | `recipes.input` and `recipes.textarea` `variants.size.md.px`            | approximated | as for buttons                                                                 |
| `component.{control,button}.padding-y`             | —                                                                       | dropped      | Chakra controls are height-driven: size variants set `h` and `px`, never `py`  |
| `component.tooltip.max-width` (only when authored) | `slotRecipes.tooltip.base.content.maxW`                                 | native       | Chakra's own ceiling is `sizes.xs` (20rem)                                     |

Acme authors only the button layer, so its buttons are pills while its inputs keep `l2`; Cathode, GOV.UK and Carbon author no tier, so Chakra's recipes keep their own proportions and take the design system's radius through `l2`. `check:component-tier` asserts all three cases (and the tooltip measure on its fixture).

**Two findings for the catalog's evidence ledgers:**

- **Tooltip measure, third witness.** Chakra constrains the tooltip content with `maxW: "xs"` (20rem), after Bootstrap's and PrimeNG's 200px ([proposal 0004](../../proposals/0004-component-geometry.md)): a third library agreeing that this element needs a width ceiling, at a different measure.
- **Focus ring composite, trigger met.** Proposal 0002 (row 8) deferred a five-field focus-ring composite until "a second component-heavy exporter (MUI, Chakra) independently needs the same 5 fields". Chakra's ring is colour (`colorPalette.focusRing`), width (`--focus-ring-width`, 2px), offset (`--focus-ring-offset`, 2px) and style (`--focus-ring-style`), set by `focusVisibleRing` in `preset-base`: four of the five. The catalog decision is its own issue ([#167](https://github.com/transtyle/transtyle/issues/167)); this exporter maps the colour only.

## Not yet measured against Chakra's whole surface

Bootstrap and PrimeNG carry a checked-in surface inventory that `check:coverage-bar` reconciles against every report. Chakra's equivalent (every leaf of `defaultConfig.theme.tokens`, `semanticTokens`, `layerStyles` and `textStyles`, plus the token-reading leaves of `recipes` and `slotRecipes`, extracted from the installed `@chakra-ui/react` like `exporter-primeng/tools/extract-surface.mjs` does for Aura, with bare recipe references resolved through `defaultSystem`) is a follow-up ([#166](https://github.com/transtyle/transtyle/issues/166)), as it is for Mantine ([#156](https://github.com/transtyle/transtyle/issues/156)): until it lands, the rows above are what the report classifies, and nothing proves the list is the whole surface.

## Ground-truth testing

`examples/*/demo/chakra/` — a Vite + React 19 app on real `@chakra-ui/react` 3 components, rendering the Nimbus Console plus the four Alert statuses. `main.tsx` passes `system` to `<ChakraProvider value={system}>` exactly as `usage.md` prescribes; the mode toggle sets `.dark` on `<html>`. The demo's build runs `tsc --noEmit` first, so the emitted config is type-checked against Chakra's own `SystemConfig` types on every CI run, the same guarantee Mantine's and PrimeNG's demos give. Role names type-check without `chakra typegen` because Chakra's `colorPalette` prop accepts any string; typegen only adds autocompletion.
