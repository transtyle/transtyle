# @transtyle/exporter-chakra

## 0.1.0-alpha.4

### Minor Changes

- dc79f14: Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

  Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1126`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

  Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

  A token that has both a `$value` and child tokens is now an error (`TST1314`), as DTCG requires; its children used to be dropped silently.

  `transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.

- abff3a3: The Chakra UI report now measures the config against Chakra's whole theming surface.

  The package ships `surface-inventory.json`, extracted from `@chakra-ui/react` 3.37.0: every token, semantic token, breakpoint, text style and layer style of Chakra's default config, and every recipe and slot-recipe leaf that reads a token (2426 entries, Chakra's hue palettes folded into one). `report.json` gains one row per part of that surface saying how many entries the emitted config sets, how many Chakra derives from it, and how many keep Chakra's value, plus one row per token-level entry kept, with the reason (a hue palette, a rung the catalog's scale does not have, a constant such as `transparent`). Recipe leaves kept on Chakra's default are counted on their family's row: each reads a token that has its own row. The emitted `theme.transtyle.ts` is unchanged.

  `@transtyle/ir` exports the helpers both the Mantine and the Chakra exporters measure their inventories with: `surfaceStatus()`, `surfaceRows()`, `surfaceCounts()` and `SURFACE_FAMILY_ROW`.

- 1edd2f6: New target: Chakra UI v3, as `@transtyle/exporter-chakra`, built in by the CLI (`transtyle add chakra`).

  It writes `theme.transtyle.ts` with two exports: `config`, a `defineConfig()` object, and `system`, the `createSystem(defaultConfig, config)` to pass to `<ChakraProvider value={system}>`. Every colour role becomes a Chakra palette with its eight semantic keys (`solid`, `contrast`, `fg`, `subtle`, `muted`, `emphasized`, `border`, `focusRing`), each with a `_light` and a `_dark` value, so `colorPalette="danger"` follows the design system in both schemes and a `.dark` class on `<html>` switches them all. Chakra's default palette becomes the `neutral` role and the Alert's statuses read `info`, `warning`, `success` and `danger`; Chakra's own hue palettes are left alone. The page colours, fonts, type scale and text styles, radii, spacing, shadows, motion, z-index, breakpoints and control heights map onto the theme as well, and the button, input and tooltip recipes take the component tier when the design system authors it. `report.json` classifies every mapping, including what Chakra derives itself (hover and active colours) and has no slot for.

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

### Patch Changes

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- 90c4e67: Compile without a filesystem: `compileProject()` and a browser entry, `@transtyle/core/browser`.

  `compileProject({ config, files, exporters })` takes the config and the token files as a map of paths to contents (JSON text, or parsed objects) and returns every target's files, `report.json` included, without writing anything. They are byte for byte what `transtyle build` writes. `@transtyle/core/browser` exports it with the rest of the API and reaches no Node built-in, so the compiler runs in a browser, a worker, an editor or a test. `compile({ cwd })` keeps its signature and results; it is now `loadProject(cwd)` → `compileProject()` → `writeResults(results, cwd)`, all three exported. Only the disk keeps two things: an `extends` chain (file paths: `loadProject()` and `compile()` follow and merge it, and pass `compileProject()` the merged config with `configChain` and `origins`, so diagnostics still name the file a key is in) and the emitted-file manifest with its drift check (`compile()` adds `transtyle-manifest.json` to the files it writes, and reports `TST1312` through `compileProject()`'s `checkOutputs` callback). `compileProject()` also takes `reports: false` to skip `report.json` when nothing will read it, as `compile({ emit: false })` does. The browser entry exports the custom-vocabulary helpers and `buildReport()` too. The Bootstrap, PrimeNG, Mantine and Chakra exporters import their `surface-inventory.json` as a JSON module instead of reading it from disk, so they load in a browser too.

  Small changes on the disk path: a `*` in the middle of a token glob now matches only directories and a final `*` only files (a directory matched by a final `*` used to fail with `TST1002`), a token file that can't be read reports `TST1002` as "no token file at this path" instead of Node's error with its absolute path, and `report.json` paths use `/` on every platform.

- Updated dependencies [dc79f14]
- Updated dependencies [abff3a3]
- Updated dependencies [305dd4e]
- Updated dependencies [5602f4a]
- Updated dependencies [e5bac21]
- Updated dependencies [ed1445d]
- Updated dependencies [a8afe0f]
- Updated dependencies [a786b21]
  - @transtyle/ir@0.1.0-alpha.4
