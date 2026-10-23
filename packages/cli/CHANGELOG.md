# @transtyle/cli

## 0.1.0-alpha.5

### Minor Changes

- 1c5ea8b: `transtyle add <npm package>` installs a community exporter by its exact npm name (or a local `npm pack` tarball). It reads the package's manifest without installing or running anything and prints it, then installs with `--ignore-scripts` and adds a target `{ "exporter": "<package>", "output": "dist/<name>" }` named after the manifest. A declarative package prints "No code will run" and installs without a question; a package that runs code asks for a yes on a terminal, `--yes` skips the question, and without a terminal it exits 2. A package with no manifest, an importer, a target already configured and an IR spec or plugin API this version does not accept are refused (exit 2) before anything is installed. Official names work as before.

### Patch Changes

- Updated dependencies [f790c6a]
- Updated dependencies [c345e51]
- Updated dependencies [511e2d2]
- Updated dependencies [864b0a6]
- Updated dependencies [0da21d6]
  - @transtyle/core@0.1.0-alpha.5
  - @transtyle/exporter-chakra@0.1.0-alpha.5
  - @transtyle/exporter-mantine@0.1.0-alpha.5
  - @transtyle/exporter-primeng@0.1.0-alpha.5
  - @transtyle/exporter-mui@0.1.0-alpha.5
  - @transtyle/exporter-storybook@0.1.0-alpha.5
  - @transtyle/exporter-echarts@0.1.0-alpha.5
  - @transtyle/exporter-radix@0.1.0-alpha.5
  - @transtyle/exporter-bootstrap@0.1.0-alpha.5
  - @transtyle/exporter-css-variables@0.1.0-alpha.5
  - @transtyle/exporter-daisyui@0.1.0-alpha.5
  - @transtyle/exporter-shadcn@0.1.0-alpha.5

## 0.1.0-alpha.4

### Minor Changes

- d2f15d2: `check` now ends with an adoption report, and notes false-friend bindings.

  The report counts the project's own `semantic.*` tokens (paths that are not catalog slots), says how many a catalog slot reads (following the alias chain, in every mode) and lists the ones none reads: they reach css-variables verbatim and no other target. Each comes with hints, the catalog slots already set to the same value or the slot whose name it shadows (`semantic.color.surface` → "did you mean to author `elevation.0.surface`?"). Custom roles are listed apart. `check --json` carries it as `adoption: { custom, bound, unbound: [{ path, type, hints }], roles }`; `@transtyle/core` exports it as `adoption(normalized)`, with `isCatalogSlot(path)`. On the examples, GOV.UK lists `govuk.focus-text` ("same value as `text.base`"), Cathode prints "7 custom tokens, all bound; 1 custom role (`crt-amber`)".

  New `TST1124` (`info`): `secondary.solid` bound to a token named `secondary` whose colour is within ΔE 0.05 of `neutral.tint` (shadcn's `--secondary`, a subtle gray), or `accent.solid` bound to an `accent` token within 0.05 of `primary.tint` or `neutral.tint` (shadcn's `--accent`, a hover wash). None of the four examples raises it.

- f7e1649: Add APCA as a contrast standard: `check.contrast.standard: "apca"` checks with APCA 0.0.98G-4g (Lc 75 for body text, Lc 60 for secondary text and on-colors) and prints a signed `Lc` in `TST2101` and in `transtyle diff`. APCA comes from the `apca-w3` package, an optional peer dependency: install it in your project (`npm install --save-dev apca-w3`) to use it; without it the build fails with the new `TST1013` instead of checking under another standard. On-colors are picked with the same method (`derivation.contrast`, which follows the check standard unless set to `wcag21` or `apca`).

  On-color contrast is now checked on resolved values with the other pairs, so two things change under WCAG too: `wcag21-aaa` applies its 7:1 to every `on-solid` and `on-tint` (they were held to 4.5:1 whatever the standard), and an authored on-color that fails is warned. Their `TST2101` message now reads like the others (`primary.on-solid vs primary.solid is 3.9:1 in light mode (< 4.5:1 wcag21-aa)`). `check --json` reports the standard it measured against (`contrast`), `diff --json` rows carry `unit` and `standard`, and `contrastRegressions` takes the `contrast` that `compile()` now returns.

- e907c95: Draft the bindings of an existing design system with `transtyle bind --suggest`.

  For every catalog slot nothing binds yet (the role `.solid`s but `neutral`, the text rungs, `elevation.0/1.surface`, `border`, `ring`, `link.*`, the fonts), it proposes the project token that fills it, read from the token's name with a versioned table (`synonyms@1`) and from its color in every mode (the page, a border, body text, a status hue, the distance to what derivation would give the slot). Each proposal carries a confidence (`high` when name and value agree) and its reason; two candidates nothing separates are reported as contested and never written. stdout is an alias token file with the reasons in `$description`, `--rules` prints the same proposals as `bindings` rules for the config, `--json` the whole report. Deterministic and offline: no model, no network, byte-identical on every run. The same report is `suggestBindings({ cwd })` in `@transtyle/core`.

- 021dbf9: Bind a whole vocabulary with pattern rules in the config.

  A new optional `bindings` array in `transtyle.config.json` holds rules like `{ "slot": "semantic.color.{role}.solid", "from": "{option.color.{role}.600}" }`. `{role}` iterates the built-in and custom color roles, `{rung}` the text rungs, `{level}` the elevation levels; `roles` restricts `{role}`. Rules expand at load into plain aliases, so exporters and `diff` see nothing new; a slot already bound in a token file always wins over a rule, a rule whose target token is missing skips that slot unless it is `required`, and `explain` names the rule behind an alias. `transtyle bindings --expand` prints the expansion as a token file to freeze it. New diagnostics `TST1117` (malformed rule), `TST1118` (required target missing) and `TST1119` (two rules bound one slot).

- dc79f14: Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

  Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1126`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

  Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

  A token that has both a `$value` and child tokens is now an error (`TST1314`), as DTCG requires; its children used to be dropped silently.

  `transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.

- c05fa2b: New `transtyle catalog [--json]` command and `catalog()` export: every slot of the catalog, with its DTCG type, the rule that fills it when unauthored, that rule's inputs and the optional anchor it requires, as a table or as one deterministic JSON object. It needs no project. Editors, agents and tools can read the vocabulary from it instead of re-deriving it from the docs or the source.
- c8c8a55: `transtyle build --out <dir>` writes every target to `<dir>/<name>` (Storybook's imports of its siblings follow), and `build --dry-run` runs the whole build and lists the files it would write, `report.json` included, without touching the disk. `--quiet` keeps only errors and the diagnostics that fail the run; `--verbose` (same as `TRANSTYLE_DEBUG=1`) adds the exporter, output directory, file sizes and the stack of a crash. `NO_COLOR` is documented and pinned: the CLI never colors. `compile()` gains the `outRoot` and `dryRun` options and `results[].planned`, `outDir` and `exporter`.
- 72d3835: Authoring completeness levels: `minimal`, `recommended` and `complete` say which slots are worth authoring next, in the order they pay off. `build` and `check` print one `authored n/m <level>` line (level from the new `check.completeness`, default `recommended`); `transtyle check --completeness <level>` lists the items left, each `missing`, `derived`, `defaulted` or `carried-over` with why it matters, and `check --json` carries them under `completeness`. Advice only: the exit code doesn't change. Core exports `completenessStatus()` and `completenessLevels()`.

  `derivation.require` accepts `"completeness:<level>"`, which fails with `TST1202` for each item of the level left, dark neutrals included. It also now fails on a required token that is `defaulted` (it only caught `derived` or absent ones before), so a project that required a slot it never authored, such as `semantic.space.4`, gets a `TST1202` it didn't get before: author the token, or drop it from `require`.

- b229573: A config can extend a base, and every command takes `--config <file>`.

  `"extends": "../design-system/transtyle.config.json"` inherits the base's tokens, modes, bindings, derivation, units and checks; the product adds its own targets (and token layers if it needs them). The nearer file wins: `tokens` are concatenated base first, `bindings` and `check.suppress` product first, `modes` and `targets` merge by entry, and `derivation`, `units` and `check` by key. Token globs resolve against the file that declares them, target outputs against the product. Each file is validated on its own, so `TST1010` names the file a bad key is in, and `report.json` and `check --json` list the files read as `config`. `--config` picks a config other than `transtyle.config.json`; its directory is the project directory. `compile()` takes the same option as `configFile`, core exports `loadConfigChain()` and `mergeConfigChain()`, and `loadConfig()` (what `transtyle migrate` reads) returns the merged config. Configs without `extends` build exactly as before, except for the new `config` line in each `report.json`.

- f708d62: Core now records which catalog slots each exporter reads while it emits. Every target result of `compile()` carries `reads` (sorted `semantic.*` / `component.*` paths), each `report.json` gains the same `reads` field (optional in the published report schema), and `transtyle check --json` lists it per target. `consumption(result)` is exported from `@transtyle/core` and turns a compile result into the slot × target matrix that `transtyle check --matrix` prints; the CLI no longer wraps exporters to record reads itself. Emitted theme files are unchanged.
- 6f8196e: Custom semantic tokens (your own `semantic.*` names outside the catalog) are now accounted for on every target. After each exporter runs, core sorts them into the ones the target writes under their own name, the ones that reach it through a catalog slot bound to them, and the ones with no path, which get a `dropped` coverage row named `(custom:<path>)` with the meaning `custom.vocabulary`. `report.json` carries the counts as `coverage.customVocabulary`, `usage.md` gains a "Custom vocabulary" section, and the build prints `custom vocabulary: 14 tokens, 10 reach this target via bindings, 4 have no path` under the target's bar, whose percentages leave these rows out. Core exports `customTokens()` (the same definition as the adoption report's) and passes the list to exporters as `ctx.customTokens`.

  An exporter can declare `openVocabulary: true` when its target takes any variable name. css-variables already wrote every custom token and now declares it; daisyUI now writes them into its theme blocks too (`semantic.color.crt.ink` → `--color-crt-ink`). Both accept `options.customTokens: "omit"` to leave them out. plugin-kit gains a `custom-vocabulary` fixture and three checks for open-vocabulary exporters.

  The Bootstrap exporter reports `$spacer`, `$font-size-base` and `$line-height-base` on rows of their own, with their exact slot, so `transtyle explain --variable '$btn-line-height' --target bootstrap` now ends at `semantic.type.leading.normal` (Acme: 714 rows become 717). The PrimeNG exporter reports its content text colours (`text.color`, `text.mutedColor` and their hover twins), which it already emitted (Acme: 356 rows become 360).

- 0ae9eb5: A JSON mapping table can now be an exporter, and a target can name the framework version it is built for.

  **Declarative exporters.** Point a target at a mapping file next to the config (`"exporter": "./ourlib.mapping.json"`): rows of `{ variable, slot, part?, format?, class?, note? }` in CSS custom properties, Sass, Less or JSON files, with selector blocks per mode value. Core runs it like any exporter and derives the coverage report from the rows; no code runs. A package can ship a mapping instead of code (`"transtyle": { "declarative": "mapping.json", … }`): the CLI reads it and never imports the package. A malformed mapping is `TST1014`, a row naming an unknown slot `TST1015`; the format is published as `schemas/mapping/v0.json`. `@transtyle/core` exports `createDeclarativeExporter`, `validateMapping`, `loadDeclarativePackage` and friends, so `conformance(createDeclarativeExporter(mapping))` tests a mapping like any plugin.

  **Version profiles.** `targets.<t>.version: "5.3.8"` selects the exporter manifest range that covers it; the exporter gets `ctx.targetVersion` and `ctx.targetProfile`, and `report.json` records `version: { requested, profile }`. A version outside every range is `TST1313`. shadcn's manifest now declares Tailwind ranges (`>=3 <4`, `>=4 <5`) instead of era names, so `"version": "3.4.17"` selects the tailwind-v3 output; `options.era` still wins when set, with a `TST2105` warning if the two disagree. plugin-kit's new `manifest-targets-ranges` check rejects a `targets` entry that isn't a version range. Without `version`, output is unchanged.

  **css-variables** now writes `palette.categorical.*` in its dark block too; its dark values were missing.

- 9b2f7ff: Diagnostics about authored tokens now carry their source location, and known warnings can be suppressed with a reason.

  A diagnostic gets `path`, `file`, `line` and `column` (1-based, the key's position) in `report.json` and `check --json`, and `transtyle check` prints them after the code (`✖ TST1105 tokens/brand.tokens.json:17:9 Dangling alias …`). A syntax error (`TST1002`) names the line the parser stopped at; a token defined in two files (`TST1103`) points at the later definition. A value Transtyle derives has no source line, so its diagnostics print as before.

  `check.suppress` takes entries `{ code, path?, reason }` to silence a warning or info. `reason` is required and must not be blank; `path` is an exact token path or a prefix ending in `.*`; without `path` the entry matches every diagnostic with that code. A suppressed diagnostic stops being printed and counted by `check.failOn`, and is listed with its reason under the new always-present `suppressed` array of `report.json` and `check --json`. Errors cannot be suppressed. An entry that silenced nothing raises the new `TST1012` (info). The config and report JSON schemas are updated.

- 0c00224: `transtyle diff` reports a changed `$description` or `$deprecated`, and the slots that newly reach a deprecated token.

  Two new lists follow the per-mode slots: `Metadata` (a token's own description or deprecation changed, in every tier) and `Deprecations` (a catalog slot now reaches, or no longer reaches, a deprecated token, with its reason). Both make `diff` exit 1, since the emitted comments change, and `--json` gains `metadata` and `deprecations` without touching existing keys. A target whose files changed only in comments prints `comments only` instead of `no output change`, with `commentLines` in `--json`. `reachedDeprecations()` in `@transtyle/core` is the shared walk behind `TST1122` and `diff`.

- c2f8cfb: Accept DTCG color objects, the color form design tools export: `{ "colorSpace": "srgb", "components": [0, 0.43, 0.84], "alpha": 1, "hex": "#026fd7" }` used to stop the build with `TST1106 Not a color string`. All fourteen DTCG color spaces are read (`srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`), at the top level, per mode, in layer files and as composite members, and the `hwb()`, `lab()`, `lch()`, `oklab()` and `color(<space> …)` CSS syntaxes now parse through the same converter (`oklch()` also takes `none`, angle units and a percentage chroma). An `srgb` object compiles to the same bytes as its hex, and a wide-gamut color keeps its chroma (`TST1120` names the sRGB fallback hex and HSL targets ship). For `srgb`, a `hex` within 0.01 per channel of the components wins, so two-decimal exports ship the designer's exact color; one further off loses to the components with a new `TST1123` warning. A malformed object (unknown `colorSpace`, not three components, `alpha` outside 0–1, a `hex` that isn't `#rrggbb`) is `TST1106` with a hint listing the accepted forms. `transtyle explain` prints the authored object (`└─ authored as {…}`), and the plugin-kit `object-form` fixture now authors its colors as DTCG objects too.
- 8418bec: `transtyle build` now writes a `transtyle-manifest.json` in each target's output directory, and `build` and `check` warn when a generated file was edited or removed by hand.

  The manifest records a sha256 of every file the exporter produced (line endings normalized, keys sorted, no timestamp) and is swapped in atomically with those files. Before writing anything, `build` and `check` compare it with the disk and raise the new `TST1312` (warning) for each file that changed or is gone, and for a manifest that can't be read. `build` warns, then overwrites. No manifest means no warning, so existing output is not reported until it has been rebuilt once. `check.failOn: "warning"` turns it into a failure and `check.suppress` can silence it. The drift check is a new `compile({ drift: true })` option, off by default for API callers.

  A build also lists, once, the files a previous build wrote that it no longer produces (`· stale: …`), and leaves them in place. The manifest's JSON schema is published at `https://transtyle.dev/schemas/manifest/v0.json`.

- c26f347: `transtyle explain` now goes both ways. `explain --variable '$btn-border-radius' --target bootstrap` starts from a target variable, follows the variables it is chained to, and explains each slot it reaches; `explain <slot> --target <t>` lists the target's variables that consume a slot. Both work without a prior build, and `--json` prints the data. The provenance tree now follows aliases to their target, so it always ends at what was authored. Core exports the lookups as `explainVariable()`, `slotConsumers()` and `coverageSlots()`; `explainToken()` lists an aliased entry's target as its one input.

  Coverage rows gain two optional fields, `slots` (the IR paths a variable reads, when its `slot` label isn't one) and `via` (the variables it follows), declared in the report schema; plugin-kit's conformance suite checks that every `slots` entry exists in the IR. The Bootstrap exporter fills them for its chained, `var(--bs-*)`, member and transition rows, and the PrimeNG exporter reports its form-field, button and typography rows one variable per row (Acme: 349 rows become 356).

- 1edd2f6: New target: Chakra UI v3, as `@transtyle/exporter-chakra`, built in by the CLI (`transtyle add chakra`).

  It writes `theme.transtyle.ts` with two exports: `config`, a `defineConfig()` object, and `system`, the `createSystem(defaultConfig, config)` to pass to `<ChakraProvider value={system}>`. Every colour role becomes a Chakra palette with its eight semantic keys (`solid`, `contrast`, `fg`, `subtle`, `muted`, `emphasized`, `border`, `focusRing`), each with a `_light` and a `_dark` value, so `colorPalette="danger"` follows the design system in both schemes and a `.dark` class on `<html>` switches them all. Chakra's default palette becomes the `neutral` role and the Alert's statuses read `info`, `warning`, `success` and `danger`; Chakra's own hue palettes are left alone. The page colours, fonts, type scale and text styles, radii, spacing, shadows, motion, z-index, breakpoints and control heights map onto the theme as well, and the button, input and tooltip recipes take the component tier when the design system authors it. `report.json` classifies every mapping, including what Chakra derives itself (hover and active colours) and has no slot for.

- 5f88120: New target: Mantine 9, as `@transtyle/exporter-mantine`, built in by the CLI (`transtyle add mantine`).

  It writes `theme.transtyle.ts` with two exports for `<MantineProvider>`: `theme`, a `createTheme()` object, and `cssVariablesResolver`. Every colour role becomes a Mantine virtual colour over a light and a dark ten-step tuple, so `color="danger"` follows the design system in both schemes, and `autoContrast` takes filled text from the role's `on-solid`. The resolver sets Mantine's per-colour variant variables (`--mantine-color-<role>-filled`, `-light`, `-outline`, …) and the page colours per scheme, straight from the compiled grid. There is no override stylesheet: Mantine writes its variables at runtime, after anything in `<head>`, and only the resolver wins that cascade. Type scale, radius, spacing, shadows, breakpoints and the button and input geometry map onto the theme as well; `usage.md` shows the wiring and `report.json` classifies every mapping, including what Mantine has no slot for (the focus ring, the z-index ladder).

- 010bd16: New target: Material UI v9, as `@transtyle/exporter-mui`, built in by the CLI (`transtyle add mui`).

  It writes `theme.transtyle.ts` with two exports: `themeOptions`, a plain `ThemeOptions` object in CSS-variables mode, and `theme`, the `createTheme(themeOptions)` to pass to `<ThemeProvider>`. Every colour role becomes a palette key in both colour schemes (`danger` is MUI's `error`; `accent`, `neutral` and custom roles are extra keys the module declares for TypeScript), so `<Button color="accent">` type-checks and follows `useColorScheme()`. Text and outlined buttons wear the role's text and outline cells, the Alert severities read their roles, Paper overlays and shadows follow the elevation ladder per scheme, the design system's ring turns on MUI's keyboard focus ring, and the dialog backdrop takes the scrim. Fonts, type roles, radii, spacing, breakpoints, motion and z-index map onto the theme too, and Button, OutlinedInput and Tooltip take the component tier when the design system authors it. Colours are written as hex, since `createTheme` refuses `oklch()`. `report.json` classifies every mapping, including what MUI has no slot for.

- ad980e8: `transtyle init` asks for your brand color, color schemes, targets, a preset and a file layout.

  In a terminal it asks; each question also has a flag (`--brand`, `--schemes`, `--targets`, `--preset recommended|minimal`, `--layout single|layered`, `--yes`), and without a terminal it asks nothing, so scripts and CI keep working. A bad value exits 2 before any file is written.

  The default scaffold changes: the neutrals now take your brand's hue and get dark values in `tokens/brand.dark.tokens.json`, loaded as a mode-scoped overlay, so a new project's dark theme is no longer its light one. Token files are listed by name in `tokens` instead of the `tokens/*.tokens.json` glob. After writing, `init` checks the project and shows the brand color with its derived `on-solid` and their contrast ratio.

  `@transtyle/core` now exports `parseColor`.

- 8c241d5: New `transtyle migrate --from style-dictionary [--write]` codemod: it rewrites Style Dictionary v3 token files (`value`/`type`/`comment` without the `$`) to DTCG, the follow-up to the `TST1307` detection.

  It reads the files your config's `tokens` list matches. Without `--write` it prints a diff per file and changes nothing; with it, the files are rewritten in place. `value`/`type`/`comment` become `$value`/`$type`/`$description`, a trailing `.value` goes from every `{a.b.c.value}` reference, Style Dictionary type names become DTCG ones (`size` → `dimension`, `fontFamilies` → `fontFamily`, `boxShadow` → `shadow`, …), a missing `type` is inferred from the top-level group, and build metadata (`attributes`, `name`, `filePath`, …) is kept under `$extensions["style-dictionary"]`. Style Dictionary has no tiers, so top-level groups move under `option` and references follow; binding the `semantic` tokens stays the author's job. The output is deterministic with keys in their original order, and a second run changes nothing. Core exports the pure transform as `migrateStyleDictionary()` (with `needsStyleDictionaryMigration()`, `loadConfig()` and `expandTokenFiles()`), and the `TST1307` hint now points at the command.

- 10f61c6: Refuse an exporter built for another IR spec or plugin API, with a diagnostic that says which and what to install, instead of letting it fail in whatever way its code happens to.

  The CLI now reads each exporter's `transtyle` manifest from its `package.json` and core checks it before running the exporter: `pluginApi` is a semver range that must accept the plugin API version core implements (`0.0.0`, so `"0"` or `"^0"`), and `irSpec` must be `"v0-draft"`. A mismatch is a `TST1309` error naming the target, the package, its version, what it declares and what core provides; every target is checked in the same run and nothing is written. An exporter package without a manifest still loads, with a `TST1310` warning. All official exporters already declare matching values.

  `@transtyle/core` exports `checkPluginCompat(manifest)` and `PLUGIN_API_VERSIONS`; a custom `loadExporter` passed to `compile()` opts into the check by returning `{ plugin, manifest, package: { name, version } }` (returning the plugin itself still works, unchecked). `@transtyle/plugin-kit` adds a `manifest-compatible` conformance check, run when `{ manifest }` is given, so a wrong value fails an exporter's own CI first.

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

- 6fb3086: `transtyle check --matrix` lists, for every catalog slot, the targets that read it, so you can see which libraries change before you author a slot. The CLI records the slots each exporter reads while it emits (third-party exporters included, no change needed on their side) and classes each reader from its coverage rows (`native`, `derived`, `approximated`, or `input` when the slot only feeds another value). With `--json`, the check report gains a `matrix` key with the same data.
- a786b21: Carry DTCG `$description` and `$deprecated` through to the outputs.

  Both fields used to load and then disappear. A token's `$description` is now written as a comment line above its variable in css-variables, shadcn and daisyUI (and above Bootstrap's `$primary…$danger`), added as `description` to the matching items of every `report.json`, and printed by `transtyle explain` under the value line. `$deprecated` (`true` or a reason, inherited from its group, `false` to opt out) reaches the same places, and a semantic or component slot whose value still comes from a deprecated token warns `TST1122` with the reason as the hint; every target's `usage.md` lists those variables under "Deprecated tokens", and their report items carry `deprecated` and `deprecatedBy`. A `$description` that isn't a string, or a `$deprecated` that isn't `true`, `false` or a string, warns `TST1311` and is ignored. Design systems that describe their tokens (GOV.UK and Carbon among the examples) see new comment lines in those files; nothing else changes. Exporter authors read `entry.description` and `entry.deprecated`, with `entryNotes()`, `blockComment()` and `lineComment()` from `@transtyle/ir`.

- e3bc8bc: Publish a JSON Schema for token files, so editors complete the catalog.

  `https://transtyle.github.io/transtyle/schemas/tokens/v0.json` lists every built-in slot path (`semantic.color.primary.solid`, `component.control.padding-x`…) and offers them as alias completions in `$value`; a misspelled slot such as `primary.solidd`, or a value on a role group, is underlined. Custom tokens stay valid. The schema is generated from the catalog; `transtyle init` now writes the `$schema` line into the scaffolded token file.

- 7167ab0: Load a Tokens Studio for Figma export as it is: `{ "tokensStudio": "tokens/figma", "themes": { … }, "sets": { … } }` in `tokens`.

  The layer takes the folder the plugin syncs to (sets, `$metadata.json`, `$themes.json`) or a single-file export, and nothing in it is rewritten. Each theme group maps to a mode dimension (`map`, or `fixed` for a group compiled with one theme), each set is placed under a tier (`sets`, default `option`) with its references rewritten to match, and the themes are lowered to a base layer plus one mode-scoped layer per non-default mode, so the build is the one a hand-written DTCG layout gives. Tokens Studio's types, unitless pixels, Figma weight names, percentages, the legacy `value`/`type` format and `.value` references are read; math and references inside values (`{space.base} * 2`, `roundTo(…)`, `rgba({color.black}, 0.5)`) are evaluated per mode. `transtyle explain` names a token's set file and Tokens Studio path, per mode, and a math token's expression. New diagnostics `TST1003`–`TST1009` cover a broken export, an unmapped theme group, the legacy format, an expression outside the supported subset, a color modifier (refused: the plugin would output a different color), themes that per-mode layers cannot express, and lossy readings. Projects without this layer compile exactly as before.

### Patch Changes

- 69dd3fb: Parse authored DTCG composites member by member.

  An authored `shadow` such as `elevation.1.shadow` used to reach the exporters with its `color` still a string, and css-variables shipped `oklch(NaN NaN NaN)` without a diagnostic. NORMALIZE now parses `shadow`, `typography`, `border` and `transition` members by their DTCG types: colors become OKLCH, member aliases resolve per mode (after DERIVE when they name a derived slot such as `{semantic.color.scrim}`), and a malformed or missing member is `TST1106` under its own path (`semantic.color.elevation.1.shadow.color`). A `shadow` may be an array of layers, with `inset`.

  css-variables and PrimeNG render stacked and inset shadows; css-variables renders authored `border` and `transition` composites as their CSS shorthands. `transtyle explain` lists an authored composite's members and the alias each came through.

- 3bab610: Round contrast ratios down in `TST2101` and in `transtyle diff`'s contrast lines, so a pair just under its threshold no longer prints as the threshold itself.

  A ratio of 4.47 against a 4.5 minimum used to read `4.5:1 (< 4.5:1)`; it now reads `4.4:1 (< 4.5:1)`, the same direction `transtyle init`'s closing swatch already rounds.

- 84e5387: Export `explainToken()` from `@transtyle/core`.

  The provenance walk behind `transtyle explain` now lives in core as `explainToken(normalized, slot, { mode })`, returning a JSON-serialisable tree (`{ slot, mode, entry, inputs }`) and throwing an `Error` with a `code` of `unknown-mode` or `unknown-slot`. The CLI is now a formatter over it; its output is unchanged.

- cd3022b: Name the target when an exporter throws, instead of printing only the exception message and exiting 2.

  A throw in an exporter's `emit` is now a `TST3001` error (`Exporter "bootstrap" crashed in emit: <message>`), and an exporter that cannot be loaded is `TST3002`. The other targets still run, so every crash is reported at once, nothing is written to disk, and the run exits 1 like any error. `TRANSTYLE_DEBUG=1` prints the stack. `transtyle explain` no longer runs the exporters at all.

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- c5c76ed: A design system that authors `semantic.color.text.base` with no dark value and leaves `semantic.color.elevation.0.surface` out no longer gets its light text on the default dark page (black on black, `TST2101` at about 1:1).

  DERIVE now swaps the light pair into dark mode, rule `swap-neutrals` (`derived`): the dark page takes the light text color and the dark text takes the light page, so dark mode has light mode's exact contrast ratio. It works the other way for a dark-native system's light mode. A new `info` diagnostic, `TST1206`, says when it happened. An authored page, with or without a dark value, and a text color with its own dark value (on the slot or on the token it aliases) are never touched, so design systems that author their dark neutrals get byte-identical output.

  `explain` now follows a rule that reads another mode into that mode and names it (`inputs: semantic.color.text.base (light) = …`): the swap's inputs, and `text.inverse`'s, which used to show the current mode's `text.base` instead of the one it copies. `explainToken()` gives those inputs a `mode`.

- Updated dependencies [d2f15d2]
- Updated dependencies [745c6fd]
- Updated dependencies [f7e1649]
- Updated dependencies [686bf5f]
- Updated dependencies [69dd3fb]
- Updated dependencies [053f796]
- Updated dependencies [e907c95]
- Updated dependencies [021dbf9]
- Updated dependencies [83354d7]
- Updated dependencies [dc79f14]
- Updated dependencies [c05fa2b]
- Updated dependencies [abff3a3]
- Updated dependencies [c8c8a55]
- Updated dependencies [8b4f61f]
- Updated dependencies [72d3835]
- Updated dependencies [b229573]
- Updated dependencies [6b67f2a]
- Updated dependencies [3bab610]
- Updated dependencies [f708d62]
- Updated dependencies [c08ff37]
- Updated dependencies [6f8196e]
- Updated dependencies [0ae9eb5]
- Updated dependencies [9ee75ab]
- Updated dependencies [9b2f7ff]
- Updated dependencies [0c00224]
- Updated dependencies [c2f8cfb]
- Updated dependencies [86cf5e4]
- Updated dependencies [2c5bd83]
- Updated dependencies [8418bec]
- Updated dependencies [c26f347]
- Updated dependencies [0ca2c0c]
- Updated dependencies [84e5387]
- Updated dependencies [1edd2f6]
- Updated dependencies [cd3022b]
- Updated dependencies [5f88120]
- Updated dependencies [010bd16]
- Updated dependencies [305dd4e]
- Updated dependencies [3dc06d7]
- Updated dependencies [e561de6]
- Updated dependencies [90c4e67]
- Updated dependencies [ad980e8]
- Updated dependencies [af6e510]
- Updated dependencies [470d195]
- Updated dependencies [8c241d5]
- Updated dependencies [dd52b96]
- Updated dependencies [4c65ad3]
- Updated dependencies [e7d4c3c]
- Updated dependencies [0e0fb68]
- Updated dependencies [5602f4a]
- Updated dependencies [e5bac21]
- Updated dependencies [6eeb154]
- Updated dependencies [ed1445d]
- Updated dependencies [10f61c6]
- Updated dependencies [1cb66fc]
- Updated dependencies [de5392a]
- Updated dependencies [7eab225]
- Updated dependencies [898bded]
- Updated dependencies [a8afe0f]
- Updated dependencies [053f796]
- Updated dependencies [5a97fd4]
- Updated dependencies [c5c76ed]
- Updated dependencies [570b458]
- Updated dependencies [a786b21]
- Updated dependencies [e3bc8bc]
- Updated dependencies [7167ab0]
- Updated dependencies [5411cc9]
- Updated dependencies [76b973a]
  - @transtyle/core@0.1.0-alpha.4
  - @transtyle/exporter-css-variables@0.1.0-alpha.4
  - @transtyle/exporter-primeng@0.1.0-alpha.4
  - @transtyle/exporter-bootstrap@0.1.0-alpha.4
  - @transtyle/exporter-chakra@0.1.0-alpha.4
  - @transtyle/exporter-daisyui@0.1.0-alpha.4
  - @transtyle/exporter-echarts@0.1.0-alpha.4
  - @transtyle/exporter-mantine@0.1.0-alpha.4
  - @transtyle/exporter-mui@0.1.0-alpha.4
  - @transtyle/exporter-shadcn@0.1.0-alpha.4
  - @transtyle/exporter-storybook@0.1.0-alpha.4
  - @transtyle/exporter-radix@0.1.0-alpha.4

## 0.1.0-alpha.3

### Patch Changes

- 3d71e2f: Ship `CHANGELOG.md` in every published package.

  npm always includes `README` and `LICENSE` regardless of the `files` allowlist, but not the changelog — so the first three alphas published with no version history at all, on the one page a stranger reads to decide whether upgrading is safe. Changesets has been writing the file since `0.1.0-alpha.0`; only the allowlist was keeping it in the repo.

  `check:manifests` now requires it, so a package added later cannot quietly ship without one.

- af10209: Ship the MIT licence text in every published package.

  npm adds a `LICENSE` file to a tarball only when one sits in the package directory. Only the monorepo root had one, so the first three alphas published twelve packages that each declared `"license": "MIT"` without carrying the text those terms ask to be distributed with them.

  Each package now holds a copy, and `check:manifests` requires it to be byte-identical to the root one — twelve copies of a licence being exactly the sort of thing that drifts a copyright year with nobody noticing.

- Updated dependencies [3d71e2f]
- Updated dependencies [af10209]
  - @transtyle/core@0.1.0-alpha.3
  - @transtyle/exporter-bootstrap@0.1.0-alpha.3
  - @transtyle/exporter-css-variables@0.1.0-alpha.3
  - @transtyle/exporter-daisyui@0.1.0-alpha.3
  - @transtyle/exporter-echarts@0.1.0-alpha.3
  - @transtyle/exporter-primeng@0.1.0-alpha.3
  - @transtyle/exporter-radix@0.1.0-alpha.3
  - @transtyle/exporter-shadcn@0.1.0-alpha.3
  - @transtyle/exporter-storybook@0.1.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- 16dc98d: Give every package a README, and point `homepage` at its documentation page.

  All twelve packages shipped `0.1.0-alpha.0` and `.1` with no README, so each rendered as a blank page on npmjs.com — the surface most people meet the project on, and the only one nobody working in the repo ever reopens. Each now says what it emits, how to use it, and that it is an experimental alpha, and links into the documentation site rather than at the monorepo root.

  `@transtyle/exporter-primeng`'s description also claimed it was "not yet registered in the CLI". It has been since C6; the sentence was published to npm twice after it stopped being true.

  `check:manifests` grew two checks for the class: a package must have a README that is more than a stub, and a `homepage` naming a docs page must name one that exists — a 404 baked into published metadata cannot be fixed without another release.

- Updated dependencies [16dc98d]
  - @transtyle/core@0.1.0-alpha.2
  - @transtyle/exporter-bootstrap@0.1.0-alpha.2
  - @transtyle/exporter-css-variables@0.1.0-alpha.2
  - @transtyle/exporter-daisyui@0.1.0-alpha.2
  - @transtyle/exporter-echarts@0.1.0-alpha.2
  - @transtyle/exporter-primeng@0.1.0-alpha.2
  - @transtyle/exporter-radix@0.1.0-alpha.2
  - @transtyle/exporter-shadcn@0.1.0-alpha.2
  - @transtyle/exporter-storybook@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- f71c23c: Write `bin.transtyle` as `src/main.js` rather than `./src/main.js`.

  npm normalizes bin paths when publishing. On npm 10.x the leading `./` was silently cleaned; on newer npm the same field is reported as "invalid and removed", which publishes a CLI package with no `transtyle` command. `0.1.0-alpha.0` was cleaned rather than stripped and is intact, but the field is now written in the form npm expects so the outcome no longer depends on the publisher's npm version.

  A new `check:manifests` guard covers the class: it verifies `publishConfig.access`, provenance metadata, that every `files` entry exists, and that `main`/`exports`/`bin` all resolve, sit inside the `files` allowlist, and (for `bin`) carry a shebang and an executable bit — none of which is observable from inside the workspace, where the binary is already linked.
  - @transtyle/core@0.1.0-alpha.1
  - @transtyle/exporter-bootstrap@0.1.0-alpha.1
  - @transtyle/exporter-css-variables@0.1.0-alpha.1
  - @transtyle/exporter-daisyui@0.1.0-alpha.1
  - @transtyle/exporter-echarts@0.1.0-alpha.1
  - @transtyle/exporter-primeng@0.1.0-alpha.1
  - @transtyle/exporter-radix@0.1.0-alpha.1
  - @transtyle/exporter-shadcn@0.1.0-alpha.1
  - @transtyle/exporter-storybook@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- First public alpha.

  Transtyle compiles a framework-agnostic description of a design system — DTCG tokens plus semantics and modes — into native theme artifacts for eight targets: Bootstrap, shadcn/ui, daisyUI, Apache ECharts, Storybook, Radix Colors/Themes, PrimeNG, and plain CSS variables. Unauthored values are filled by deterministic, inspectable derivation rules rather than hidden defaults, every generated value carries provenance you can query with `transtyle explain`, and every build emits a coverage report saying what mapped natively, what was derived, what was approximated, and what the target cannot express.

  All three token tiers — raw/option, semantic and component — are mapped on the two component-heavy targets, Bootstrap and PrimeNG, each measured against a checked-in inventory of the target's real theming surface so gaps are reported rather than quietly skipped.

  Import is DTCG only in this release. Tailwind, Figma and CSS-custom-property importers are post-alpha.

  **This is an experimental alpha.** Breaking changes ship without a deprecation cycle: the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases, and none of it carries a stability or support promise. Pin an exact version, and treat generated files as disposable output you regenerate rather than hand-edit. The reasoning is recorded in ADR-0010; the release process is documented in RELEASING.md.

### Patch Changes

- Updated dependencies
  - @transtyle/core@0.1.0-alpha.0
  - @transtyle/exporter-bootstrap@0.1.0-alpha.0
  - @transtyle/exporter-css-variables@0.1.0-alpha.0
  - @transtyle/exporter-daisyui@0.1.0-alpha.0
  - @transtyle/exporter-echarts@0.1.0-alpha.0
  - @transtyle/exporter-primeng@0.1.0-alpha.0
  - @transtyle/exporter-radix@0.1.0-alpha.0
  - @transtyle/exporter-shadcn@0.1.0-alpha.0
  - @transtyle/exporter-storybook@0.1.0-alpha.0
