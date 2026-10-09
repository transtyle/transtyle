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

## Measured against Chakra's whole surface

Like Bootstrap, PrimeNG and Mantine, Chakra carries a checked-in surface inventory, `packages/exporter-chakra/surface-inventory.json`, that `check:coverage-bar` reconciles against every report.

<!-- measured: chakra.surface.total = 2426 -->
<!-- measured: chakra.surface.families = 8 -->

**What it holds.** `tools/extract-surface.mjs` reads `defaultConfig` from the installed `@chakra-ui/react` (a demo dependency, never a package dependency) and writes 2426 entries in 8 families. The token tiers: every leaf of `theme.breakpoints`, `theme.tokens` and `theme.semanticTokens`, and every leaf of `theme.textStyles` and `theme.layerStyles` except their structure (a `position`, a `content`, or a value that only wires a component-local variable such as `var(--indicator-offset-y, 0)`). The `colorPalette` family: the default palette route, `globalCss.html.colorPalette`, and the eight `colorPalette.<key>` the styles read through it. The recipe tier: every leaf of `theme.recipes` and `theme.slotRecipes` whose CSS reads a token. Chakra writes those references as bare names whose category depends on the CSS property (`px: "4"` is spacing, `borderRadius: "l2"` a radius), so the extractor resolves each leaf with `defaultSystem.css()` from the same package and maps the `var(--chakra-…)` it produces back to the token; a leaf that reads no token (`display: "inline-flex"`) is not a theming slot. Palettes are folded so the inventory does not grow with Chakra's ten hue palettes: `colors.red.solid` … `colors.pink.solid` are one entry, `semanticTokens.colors.<palette>.solid`, and their shades one, `tokens.colors.<palette>.<shade>`; the alpha scales fold their shades under their own name. `sizes` folds where it is not a scale of its own: the steps that repeat `spacing` as literal values (`sizes.<step>`), the fractions and the CSS keywords and viewport units. `conditions`, `utilities`, `keyframes`, `animationStyles` and the rest of `globalCss` are not in it: they are Chakra's machinery, not values a theme sets.

**How an entry depends on the theme.** Each entry records `from`, what it reads: the `{reference}` of a semantic token (`bg.subtle` is `{colors.gray.50}`), the token a text or layer style reads, the tokens a recipe leaf's CSS reads. Negative spacing (`spacing.-1`) shares its variable with the step, so the step is what is recorded. The extraction is deterministic: no timestamps, sorted, one entry per line so a Chakra upgrade shows as a readable diff.

**Classification** (`src/surface-coverage.js`; the three-way walk and the report rows are `@transtyle/ir`'s `surfaceStatus()` and `surfaceRows()`, shared with Mantine). An entry is **set** when the emitted config has the leaf (a `colorPalette.<key>` is set when the routed palette has that key); it **follows** when it is not written but everything in its `from` is set or follows, so Chakra derives it from this theme (`recipes.button.base.borderRadius` reads `l2`); otherwise it keeps **Chakra's default**. In the token tiers each of those has a reason in the module's `REASONS` table, matched by id pattern, with its catalog-signals `meaning` where it has one (`color.named-palette`, `target.config`, `scale.extra-rung`, `type.display-ladder`, `geometry.component`, `shadow.inset`, `effect.blur`, `motion.keyframes`); an entry on Chakra's default only because something it reads is gets a note naming that, with the same class and meaning. An entry the exporter maps from a catalog slot the design system does not define names the slot (GOV.UK's `fonts.mono` and `fg.inverted`); one with no reason at all gets a catch-all the check refuses on the four examples, so an entry new in a Chakra upgrade still needs a reason of its own.

**The reconciliation rule** is Mantine's: one summary row per family, `tokens.* (161 entries)` with `n set · n follow · n on Chakra's default`, whose counts must add up to the family's size, and a named row, with a note, for every token-tier entry on Chakra's default. The recipe tier is the exception: its thousands of leaves are on Chakra's default only because a token they read is, so `recipes` and `slotRecipes` are _derived_ families with a summary row alone, and the check holds their default count between the leaves that read a named default (less those the exporter sets) and all of them. It fails when a fresh extraction differs from the checked-in file (a Chakra upgrade, or a hand edit) with `node packages/exporter-chakra/tools/extract-surface.mjs --write` in the message.

<!-- measured: acme.chakra.set = 127 -->
<!-- measured: acme.chakra.follow = 1526 -->
<!-- measured: acme.chakra.default = 773 -->
<!-- measured: cathode.chakra.default = 774 -->
<!-- measured: carbon.chakra.default = 774 -->
<!-- measured: govuk.chakra.set = 122 -->
<!-- measured: govuk.chakra.follow = 1524 -->
<!-- measured: govuk.chakra.default = 780 -->

| Example                 | Set | Follow | Chakra's default |
| ----------------------- | --- | ------ | ---------------- |
| Acme                    | 127 | 1526   | 773              |
| Cathode, Carbon         | 124 | 1528   | 774              |
| GOV.UK (no dark scheme) | 122 | 1524   | 780              |

Acme sets three more entries than Cathode and Carbon because it authors its button layer and its tooltip measure (the component tier, above). On Acme, 140 of the defaults are token-tier entries, each on its own row: Chakra's hue palettes and ramps (kept by design), the rungs its scales have beyond the catalog's (half and large spacing steps, the thin to black weights, `faster` and `slowest`, `docked`, `skipNav` and `max`, shadows `xs` and `2xl`), its measure scale (`sizes.xs` … `8xl`), constants (`transparent`, fractions, viewport sizes, cursors, aspect ratios), the text styles' literal line heights, blurs and animations. The other 633 are recipe leaves that read one of those; most read a `sizes` step, the icon and control sizes Chakra writes as literal steps rather than through `spacing`, or a half spacing step. GOV.UK adds its missing `font.mono` and `text.inverse`; having no dark scheme changes nothing here, because a semantic token with one value is still set.

## Ground-truth testing

`examples/*/demo/chakra/` — a Vite + React 19 app on real `@chakra-ui/react` 3 components, rendering the Nimbus Console plus the four Alert statuses. `main.tsx` passes `system` to `<ChakraProvider value={system}>` exactly as `usage.md` prescribes; the mode toggle sets `.dark` on `<html>`. The demo's build runs `tsc --noEmit` first, so the emitted config is type-checked against Chakra's own `SystemConfig` types on every CI run, the same guarantee Mantine's and PrimeNG's demos give. Role names type-check without `chakra typegen` because Chakra's `colorPalette` prop accepts any string; typegen only adds autocompletion.
