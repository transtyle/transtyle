# @transtyle/exporter-mui

## 0.1.0-alpha.5

### Minor Changes

- c345e51: The TypeScript targets write a slot's `$description` and `$deprecated` as JSDoc.

  Chakra, Mantine, PrimeNG, MUI and Storybook put a `/** … */` block above each property that maps exactly one slot, and ECharts does the same in its `.js` theme (the `.json` twin takes no comments). The description shows on hover in an editor, and `@deprecated <reason>` strikes the property through. Radix writes the same text as a `/* … */` comment above each variable that is exactly one grid cell. A property computed from several slots, or from a derived one, gets no comment, and a `*/` in a description is broken up so the file still parses. `@transtyle/ir` exports `jsdocComment()`, `Documented`, `withDoc()` and `withoutDocs()` for exporters that print an object tree.

- 511e2d2: The catalog gains the focus ring's geometry: `semantic.ring.width` and `semantic.ring.offset`, two scalars next to `semantic.color.ring` (proposal 0002, row 8, #167).

  The width defaults to `{semantic.border-width.medium}` (2px) and the offset to 2px. There is no style and no shadow slot, and no composite: every outline-family library draws a solid ring, and Chakra UI, Material UI, Adobe Spectrum and Material 3 all publish the width and the offset as separate values. The targets write them only when you author them (the width itself, or through `border-width.medium`), so a design system that doesn't keeps each library's own ring: PrimeNG's `focusRing.width` and `.offset`, Chakra's `--focus-ring-width` and `--focus-ring-offset` on `<html>` (every `focusVisibleRing` variant reads them), Material UI's `focusVisible.outlineWidth` and `.outlineOffset`, and Bootstrap's `$focus-ring-width` (its ring is a box-shadow halo with no gap, so the offset is reported `dropped`). The css-variables target writes `--ring-width` and `--ring-offset` for everyone. Mantine, daisyUI, Radix Themes and shadcn/ui draw their rings in component CSS and report both slots `dropped`. The GOV.UK example authors its 3px `$govuk-focus-width`, so its PrimeNG, Chakra, Material UI and Bootstrap themes now draw a 3px ring.

  `isAuthored(map, path)` in `@transtyle/ir` is the test the exporters share: `authored` or `aliased`, or an `alias(<slot>)` default of a slot the design system authored. `transtyle catalog` lists 266 slots.

### Patch Changes

- Updated dependencies [c345e51]
- Updated dependencies [511e2d2]
  - @transtyle/ir@0.1.0-alpha.5

## 0.1.0-alpha.4

### Minor Changes

- dc79f14: Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

  Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1126`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

  Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

  A token that has both a `$value` and child tokens is now an error (`TST1314`), as DTCG requires; its children used to be dropped silently.

  `transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.

- 010bd16: New target: Material UI v9, as `@transtyle/exporter-mui`, built in by the CLI (`transtyle add mui`).

  It writes `theme.transtyle.ts` with two exports: `themeOptions`, a plain `ThemeOptions` object in CSS-variables mode, and `theme`, the `createTheme(themeOptions)` to pass to `<ThemeProvider>`. Every colour role becomes a palette key in both colour schemes (`danger` is MUI's `error`; `accent`, `neutral` and custom roles are extra keys the module declares for TypeScript), so `<Button color="accent">` type-checks and follows `useColorScheme()`. Text and outlined buttons wear the role's text and outline cells, the Alert severities read their roles, Paper overlays and shadows follow the elevation ladder per scheme, the design system's ring turns on MUI's keyboard focus ring, and the dialog backdrop takes the scrim. Fonts, type roles, radii, spacing, breakpoints, motion and z-index map onto the theme too, and Button, OutlinedInput and Tooltip take the component tier when the design system authors it. Colours are written as hex, since `createTheme` refuses `oklch()`. `report.json` classifies every mapping, including what MUI has no slot for.

- dd52b96: The Material UI report now measures the theme against MUI's whole theming surface.

  The package ships `surface-inventory.json`, extracted from `@mui/material` 9.5.0 by calling `createTheme()` in CSS-variables mode with both colour schemes: every CSS variable its style sheets write, per block, and every theme leaf no variable carries (the typography variants, transitions, breakpoints, the opt-in focus ring, `motion.reducedMotion`, the palette's `tonalOffset` and `contrastThreshold`), 491 entries. Each per-component palette token records whether MUI points it at another palette variable or writes its value out. `report.json` gains one row per part of that surface (the theme leaves, and the `:root`, `light` and `dark` blocks) saying how many entries the emitted theme sets, how many MUI computes from it, and how many keep MUI's value, plus one row per entry kept, with the reason (the grey ramp and what reads it, the state veils, the uppercase button, the letter spacing a design system's type roles leave out, or, for a design system without a dark scheme, the dark block). These rows replace the single `colorSchemes.*.opacity.*` row. The emitted `theme.transtyle.ts` is unchanged.

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

### Patch Changes

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- Updated dependencies [dc79f14]
- Updated dependencies [abff3a3]
- Updated dependencies [305dd4e]
- Updated dependencies [5602f4a]
- Updated dependencies [e5bac21]
- Updated dependencies [ed1445d]
- Updated dependencies [a8afe0f]
- Updated dependencies [a786b21]
  - @transtyle/ir@0.1.0-alpha.4
