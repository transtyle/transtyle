# @transtyle/core

## 0.1.0-alpha.4

### Minor Changes

- d2f15d2: `check` now ends with an adoption report, and notes false-friend bindings.

  The report counts the project's own `semantic.*` tokens (paths that are not catalog slots), says how many a catalog slot reads (following the alias chain, in every mode) and lists the ones none reads: they reach css-variables verbatim and no other target. Each comes with hints, the catalog slots already set to the same value or the slot whose name it shadows (`semantic.color.surface` → "did you mean to author `elevation.0.surface`?"). Custom roles are listed apart. `check --json` carries it as `adoption: { custom, bound, unbound: [{ path, type, hints }], roles }`; `@transtyle/core` exports it as `adoption(normalized)`, with `isCatalogSlot(path)`. On the examples, GOV.UK lists `govuk.focus-text` ("same value as `text.base`"), Cathode prints "7 custom tokens, all bound; 1 custom role (`crt-amber`)".

  New `TST1124` (`info`): `secondary.solid` bound to a token named `secondary` whose colour is within ΔE 0.05 of `neutral.tint` (shadcn's `--secondary`, a subtle gray), or `accent.solid` bound to an `accent` token within 0.05 of `primary.tint` or `neutral.tint` (shadcn's `--accent`, a hover wash). None of the four examples raises it.

- f7e1649: Add APCA as a contrast standard: `check.contrast.standard: "apca"` checks with APCA 0.0.98G-4g (Lc 75 for body text, Lc 60 for secondary text and on-colors) and prints a signed `Lc` in `TST2101` and in `transtyle diff`. APCA comes from the `apca-w3` package, an optional peer dependency: install it in your project (`npm install --save-dev apca-w3`) to use it; without it the build fails with the new `TST1013` instead of checking under another standard. On-colors are picked with the same method (`derivation.contrast`, which follows the check standard unless set to `wcag21` or `apca`).

  On-color contrast is now checked on resolved values with the other pairs, so two things change under WCAG too: `wcag21-aaa` applies its 7:1 to every `on-solid` and `on-tint` (they were held to 4.5:1 whatever the standard), and an authored on-color that fails is warned. Their `TST2101` message now reads like the others (`primary.on-solid vs primary.solid is 3.9:1 in light mode (< 4.5:1 wcag21-aa)`). `check --json` reports the standard it measured against (`contrast`), `diff --json` rows carry `unit` and `standard`, and `contrastRegressions` takes the `contrast` that `compile()` now returns.

- 053f796: Two new authoring checks. `TST1120` (info) names an authored colour that a slot reaches and that lies outside sRGB, with the hex every target that writes hex or HSL ships instead (Bootstrap and Storybook clamp it without saying so anywhere else). `TST1121` (warning) flags a partially authored `space`, `type.size`, `size.control`, `border-width`, `breakpoint` or `duration` scale that ships out of order: a catalog default out of order with an authored rung (an 8px `space.1`–`space.4` next to the 4px defaults), or a scale authored only under its own names (`space.sm`/`md`/`lg`), which no target reads. Tuning one rung in order stays silent.

  Exporters can now return `diagnostics: [{ severity, code, message, hint? }]` from `emit()` next to `files` and `coverage`. Core accepts `info` and `warning`, prefixes each message with the target instance name and sets `target`; a malformed entry is reported as `TST3001`. `checkExporterDiagnostics` is exported for tools that validate the same shape.

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
- 8b4f61f: New warnings `TST2102` and `TST2103` flag colors that can't be told apart.

  `TST2102` fires when two entries of `palette.categorical.1-8` are closer than 0.05 in OKLab (ΔE<sub>OK</sub>) in a mode, `TST2103` when the `solid` colors of `success`, `warning`, `danger`, `info` or a role archetyped `status` are that close or identical, the shape of a design system whose four alert colors all resolve to one value in dark mode. Colors under the threshold are grouped, so four identical roles give one warning that names all four. Two roles bound to the very same token are skipped, since that is deliberate. The derived palette and status roles never trigger them; they guard authored values. Both are warnings, so `check.failOn` decides whether they fail a build.

- 72d3835: Authoring completeness levels: `minimal`, `recommended` and `complete` say which slots are worth authoring next, in the order they pay off. `build` and `check` print one `authored n/m <level>` line (level from the new `check.completeness`, default `recommended`); `transtyle check --completeness <level>` lists the items left, each `missing`, `derived`, `defaulted` or `carried-over` with why it matters, and `check --json` carries them under `completeness`. Advice only: the exit code doesn't change. Core exports `completenessStatus()` and `completenessLevels()`.

  `derivation.require` accepts `"completeness:<level>"`, which fails with `TST1202` for each item of the level left, dark neutrals included. It also now fails on a required token that is `defaulted` (it only caught `derived` or absent ones before), so a project that required a slot it never authored, such as `semantic.space.4`, gets a `TST1202` it didn't get before: author the token, or drop it from `require`.

- b229573: A config can extend a base, and every command takes `--config <file>`.

  `"extends": "../design-system/transtyle.config.json"` inherits the base's tokens, modes, bindings, derivation, units and checks; the product adds its own targets (and token layers if it needs them). The nearer file wins: `tokens` are concatenated base first, `bindings` and `check.suppress` product first, `modes` and `targets` merge by entry, and `derivation`, `units` and `check` by key. Token globs resolve against the file that declares them, target outputs against the product. Each file is validated on its own, so `TST1010` names the file a bad key is in, and `report.json` and `check --json` list the files read as `config`. `--config` picks a config other than `transtyle.config.json`; its directory is the project directory. `compile()` takes the same option as `configFile`, core exports `loadConfigChain()` and `mergeConfigChain()`, and `loadConfig()` (what `transtyle migrate` reads) returns the merged config. Configs without `extends` build exactly as before, except for the new `config` line in each `report.json`.

- 6b67f2a: Add a config-level `rem` base: `"units": { "remBase": "10px" }` (default `"16px"`, so existing output does not change). Exporters that convert `rem` to pixels read it through the new `ctx.units` (`toPx`, `toRem`, `remBase`): ECharts used a fixed 16 and its `approximated` note now names the configured base; Storybook uses it unless its own `options.remBase` is set. A base that is not a positive `px` length is a `TST1010` error.
- f708d62: Core now records which catalog slots each exporter reads while it emits. Every target result of `compile()` carries `reads` (sorted `semantic.*` / `component.*` paths), each `report.json` gains the same `reads` field (optional in the published report schema), and `transtyle check --json` lists it per target. `consumption(result)` is exported from `@transtyle/core` and turns a compile result into the slot × target matrix that `transtyle check --matrix` prints; the CLI no longer wraps exporters to record reads itself. Emitted theme files are unchanged.
- c08ff37: Coverage rows can say what an `unsupported` slot is missing: `report.json` rows accept an optional `meaning` key (`"icon.size"`, `"icon.asset"`), shared across exporters so the same missing concept can be counted wherever it shows up. Bootstrap's 56 `unsupported` rows and ECharts' one now carry it.

  PrimeNG's coverage no longer counts its own primary ramp as left on Aura's default: the eleven `primary.*` steps it emits are reported as driven (Acme: 89 driven, 1104 on Aura's default, was 78 and 1115).

- 6f8196e: Custom semantic tokens (your own `semantic.*` names outside the catalog) are now accounted for on every target. After each exporter runs, core sorts them into the ones the target writes under their own name, the ones that reach it through a catalog slot bound to them, and the ones with no path, which get a `dropped` coverage row named `(custom:<path>)` with the meaning `custom.vocabulary`. `report.json` carries the counts as `coverage.customVocabulary`, `usage.md` gains a "Custom vocabulary" section, and the build prints `custom vocabulary: 14 tokens, 10 reach this target via bindings, 4 have no path` under the target's bar, whose percentages leave these rows out. Core exports `customTokens()` (the same definition as the adoption report's) and passes the list to exporters as `ctx.customTokens`.

  An exporter can declare `openVocabulary: true` when its target takes any variable name. css-variables already wrote every custom token and now declares it; daisyUI now writes them into its theme blocks too (`semantic.color.crt.ink` → `--color-crt-ink`). Both accept `options.customTokens: "omit"` to leave them out. plugin-kit gains a `custom-vocabulary` fixture and three checks for open-vocabulary exporters.

  The Bootstrap exporter reports `$spacer`, `$font-size-base` and `$line-height-base` on rows of their own, with their exact slot, so `transtyle explain --variable '$btn-line-height' --target bootstrap` now ends at `semantic.type.leading.normal` (Acme: 714 rows become 717). The PrimeNG exporter reports its content text colours (`text.color`, `text.mutedColor` and their hover twins), which it already emitted (Acme: 356 rows become 360).

- 0ae9eb5: A JSON mapping table can now be an exporter, and a target can name the framework version it is built for.

  **Declarative exporters.** Point a target at a mapping file next to the config (`"exporter": "./ourlib.mapping.json"`): rows of `{ variable, slot, part?, format?, class?, note? }` in CSS custom properties, Sass, Less or JSON files, with selector blocks per mode value. Core runs it like any exporter and derives the coverage report from the rows; no code runs. A package can ship a mapping instead of code (`"transtyle": { "declarative": "mapping.json", … }`): the CLI reads it and never imports the package. A malformed mapping is `TST1014`, a row naming an unknown slot `TST1015`; the format is published as `schemas/mapping/v0.json`. `@transtyle/core` exports `createDeclarativeExporter`, `validateMapping`, `loadDeclarativePackage` and friends, so `conformance(createDeclarativeExporter(mapping))` tests a mapping like any plugin.

  **Version profiles.** `targets.<t>.version: "5.3.8"` selects the exporter manifest range that covers it; the exporter gets `ctx.targetVersion` and `ctx.targetProfile`, and `report.json` records `version: { requested, profile }`. A version outside every range is `TST1313`. shadcn's manifest now declares Tailwind ranges (`>=3 <4`, `>=4 <5`) instead of era names, so `"version": "3.4.17"` selects the tailwind-v3 output; `options.era` still wins when set, with a `TST2105` warning if the two disagree. plugin-kit's new `manifest-targets-ranges` check rejects a `targets` entry that isn't a version range. Without `version`, output is unchanged.

  **css-variables** now writes `palette.categorical.*` in its dark block too; its dark values were missing.

- 9ee75ab: An unauthored `semantic.color.text.base` now defaults per mode instead of staying empty.

  DERIVE picks whichever of near-black and white contrasts more with the mode's page (`elevation.0.surface`), with provenance `defaulted` and rule `default-text`, so a design system that authors only `primary.solid` gets near-black text on white in light mode and white on near-black in dark mode, and the whole content side derives from it: `text.muted`, `text.subtle`, `text.disabled`, `text.strong`, `text.inverse` and every `<role>.text-strong`. Exporters that used to leave the body text to the target's own defaults (shadcn `--foreground`, daisyUI `--color-base-content`, Bootstrap `$body-color` and `$dark`, Storybook `textColor`, ECharts `textStyle.color`…) now emit it. An authored `text.base` always wins, including an alias that resolves after derivation; design systems that author it get byte-identical output.

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

- 90c4e67: Compile without a filesystem: `compileProject()` and a browser entry, `@transtyle/core/browser`.

  `compileProject({ config, files, exporters })` takes the config and the token files as a map of paths to contents (JSON text, or parsed objects) and returns every target's files, `report.json` included, without writing anything. They are byte for byte what `transtyle build` writes. `@transtyle/core/browser` exports it with the rest of the API and reaches no Node built-in, so the compiler runs in a browser, a worker, an editor or a test. `compile({ cwd })` keeps its signature and results; it is now `loadProject(cwd)` → `compileProject()` → `writeResults(results, cwd)`, all three exported. Only the disk keeps two things: an `extends` chain (file paths: `loadProject()` and `compile()` follow and merge it, and pass `compileProject()` the merged config with `configChain` and `origins`, so diagnostics still name the file a key is in) and the emitted-file manifest with its drift check (`compile()` adds `transtyle-manifest.json` to the files it writes, and reports `TST1312` through `compileProject()`'s `checkOutputs` callback). `compileProject()` also takes `reports: false` to skip `report.json` when nothing will read it, as `compile({ emit: false })` does. The browser entry exports the custom-vocabulary helpers and `buildReport()` too. The Bootstrap, PrimeNG, Mantine and Chakra exporters import their `surface-inventory.json` as a JSON module instead of reading it from disk, so they load in a browser too.

  Small changes on the disk path: a `*` in the middle of a token glob now matches only directories and a final `*` only files (a directory matched by a final `*` used to fail with `TST1002`), a token file that can't be read reports `TST1002` as "no token file at this path" instead of Node's error with its absolute path, and `report.json` paths use `/` on every platform.

- ad980e8: `transtyle init` asks for your brand color, color schemes, targets, a preset and a file layout.

  In a terminal it asks; each question also has a flag (`--brand`, `--schemes`, `--targets`, `--preset recommended|minimal`, `--layout single|layered`, `--yes`), and without a terminal it asks nothing, so scripts and CI keep working. A bad value exits 2 before any file is written.

  The default scaffold changes: the neutrals now take your brand's hue and get dark values in `tokens/brand.dark.tokens.json`, loaded as a mode-scoped overlay, so a new project's dark theme is no longer its light one. Token files are listed by name in `tokens` instead of the `tokens/*.tokens.json` glob. After writing, `init` checks the project and shows the brand color with its derived `on-solid` and their contrast ratio.

  `@transtyle/core` now exports `parseColor`.

- 8c241d5: New `transtyle migrate --from style-dictionary [--write]` codemod: it rewrites Style Dictionary v3 token files (`value`/`type`/`comment` without the `$`) to DTCG, the follow-up to the `TST1307` detection.

  It reads the files your config's `tokens` list matches. Without `--write` it prints a diff per file and changes nothing; with it, the files are rewritten in place. `value`/`type`/`comment` become `$value`/`$type`/`$description`, a trailing `.value` goes from every `{a.b.c.value}` reference, Style Dictionary type names become DTCG ones (`size` → `dimension`, `fontFamilies` → `fontFamily`, `boxShadow` → `shadow`, …), a missing `type` is inferred from the top-level group, and build metadata (`attributes`, `name`, `filePath`, …) is kept under `$extensions["style-dictionary"]`. Style Dictionary has no tiers, so top-level groups move under `option` and references follow; binding the `semantic` tokens stays the author's job. The output is deterministic with keys in their original order, and a second run changes nothing. Core exports the pure transform as `migrateStyleDictionary()` (with `needsStyleDictionaryMigration()`, `loadConfig()` and `expandTokenFiles()`), and the `TST1307` hint now points at the command.

- 4c65ad3: `check` now reports unused and duplicated option tokens.

  `TST1114` lists `option.*` tokens that no alias resolves to, and `TST1115` groups option tokens of one type that resolve to the same value (colors compare in OKLCH within a tolerance far below a visible difference). Both are `info` by default, so `failOn: warning` CI is unaffected, and are reported once per build with the count and the first paths in the message; the full lists (`paths`) are on the diagnostic in `check --json` and `report.json`. A new `check.hygiene` config block, `{ "unusedOption", "duplicateOption" }`, sets each to `info`, `warning` or `off`. Three of the four examples carry unused options (acme 3, govuk 8, carbon 2), now reported as `info`.

- e7d4c3c: `transtyle check` now warns (`TST1315`) when generated files that nobody edited no longer match what the tokens compile to, the "forgot to rebuild" case.

  `check` already has every target's fresh files in memory. When a file still matches the hash in its `transtyle-manifest.json` (so `TST1312` is silent) but the fresh compile writes different bytes, `check` raises one warning per target, naming the first files. Files `TST1312` already reported, files the manifest doesn't list, and targets without a usable manifest are left out. `build` doesn't raise it, since it rewrites the files at once. It follows `check.failOn` and `check.suppress` like any warning.

- 0e0fb68: Add explicit override layers to the `tokens` manifest.

  A layer written `{ "files": "tokens/product.tokens.json", "override": true }` may redefine tokens from earlier layers without `TST1103`, so intentional core, business-unit and product layering no longer warns as duplicates; an unmarked duplicate still does. A marked layer that defines a token no earlier layer defined gets the new `TST1116` warning (a likely typo), unless it is marked `"override": "extend"`. `override` also silences `TST1108` on a mode-scoped layer. `transtyle explain` prints `overrides <file>` for a token an override layer replaced. The object form of a layer now needs `mode` or `override`; the config JSON schema is updated.

- 10f61c6: Refuse an exporter built for another IR spec or plugin API, with a diagnostic that says which and what to install, instead of letting it fail in whatever way its code happens to.

  The CLI now reads each exporter's `transtyle` manifest from its `package.json` and core checks it before running the exporter: `pluginApi` is a semver range that must accept the plugin API version core implements (`0.0.0`, so `"0"` or `"^0"`), and `irSpec` must be `"v0-draft"`. A mismatch is a `TST1309` error naming the target, the package, its version, what it declares and what core provides; every target is checked in the same run and nothing is written. An exporter package without a manifest still loads, with a `TST1310` warning. All official exporters already declare matching values.

  `@transtyle/core` exports `checkPluginCompat(manifest)` and `PLUGIN_API_VERSIONS`; a custom `loadExporter` passed to `compile()` opts into the check by returning `{ plugin, manifest, package: { name, version } }` (returning the plugin itself still works, unchecked). `@transtyle/plugin-kit` adds a `manifest-compatible` conformance check, run when `{ manifest }` is given, so a wrong value fails an exporter's own CI first.

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

- c5c76ed: A design system that authors `semantic.color.text.base` with no dark value and leaves `semantic.color.elevation.0.surface` out no longer gets its light text on the default dark page (black on black, `TST2101` at about 1:1).

  DERIVE now swaps the light pair into dark mode, rule `swap-neutrals` (`derived`): the dark page takes the light text color and the dark text takes the light page, so dark mode has light mode's exact contrast ratio. It works the other way for a dark-native system's light mode. A new `info` diagnostic, `TST1206`, says when it happened. An authored page, with or without a dark value, and a text color with its own dark value (on the slot or on the token it aliases) are never touched, so design systems that author their dark neutrals get byte-identical output.

  `explain` now follows a rule that reads another mode into that mode and names it (`inputs: semantic.color.text.base (light) = …`): the swap's inputs, and `text.inverse`'s, which used to show the current mode's `text.base` instead of the one it copies. `explainToken()` gives those inputs a `mode`.

- 570b458: Add `targets.<t>.modes` to emit only some mode values for a target.

  A project declares its modes once and every target used to receive the whole matrix, so a light-only Bootstrap site next to a light+dark shadcn app meant a second config or unwanted dark blocks. A target can now narrow it: `"bootstrap": { "modes": { "color-scheme": ["light"] } }` keeps only that value (a dimension you don't name keeps all of its values). Derivation and checks still run once on the full matrix; the exporter receives only the kept combinations, so a single-value dimension behaves like today's single-mode projects. A subset that names an undeclared dimension or value, or leaves out the dimension's default, is the new error `TST1308` and nothing is emitted for any target. A dimension narrowed this way is a deliberate exclusion: no `dropped` coverage row, and the target's `usage.md` lists the modes its files contain. The Bootstrap, shadcn, daisyUI and css-variables `usage.md` no longer describe a dark mode they didn't generate. The config JSON schema gains the `modes` target key.

- a786b21: Carry DTCG `$description` and `$deprecated` through to the outputs.

  Both fields used to load and then disappear. A token's `$description` is now written as a comment line above its variable in css-variables, shadcn and daisyUI (and above Bootstrap's `$primary…$danger`), added as `description` to the matching items of every `report.json`, and printed by `transtyle explain` under the value line. `$deprecated` (`true` or a reason, inherited from its group, `false` to opt out) reaches the same places, and a semantic or component slot whose value still comes from a deprecated token warns `TST1122` with the reason as the hint; every target's `usage.md` lists those variables under "Deprecated tokens", and their report items carry `deprecated` and `deprecatedBy`. A `$description` that isn't a string, or a `$deprecated` that isn't `true`, `false` or a string, warns `TST1311` and is ignored. Design systems that describe their tokens (GOV.UK and Carbon among the examples) see new comment lines in those files; nothing else changes. Exporter authors read `entry.description` and `entry.deprecated`, with `entryNotes()`, `blockComment()` and `lineComment()` from `@transtyle/ir`.

- e3bc8bc: Publish a JSON Schema for token files, so editors complete the catalog.

  `https://transtyle.github.io/transtyle/schemas/tokens/v0.json` lists every built-in slot path (`semantic.color.primary.solid`, `component.control.padding-x`…) and offers them as alias completions in `$value`; a misspelled slot such as `primary.solidd`, or a value on a role group, is underlined. Custom tokens stay valid. The schema is generated from the catalog; `transtyle init` now writes the `$schema` line into the scaffolded token file.

- 7167ab0: Load a Tokens Studio for Figma export as it is: `{ "tokensStudio": "tokens/figma", "themes": { … }, "sets": { … } }` in `tokens`.

  The layer takes the folder the plugin syncs to (sets, `$metadata.json`, `$themes.json`) or a single-file export, and nothing in it is rewritten. Each theme group maps to a mode dimension (`map`, or `fixed` for a group compiled with one theme), each set is placed under a tier (`sets`, default `option`) with its references rewritten to match, and the themes are lowered to a base layer plus one mode-scoped layer per non-default mode, so the build is the one a hand-written DTCG layout gives. Tokens Studio's types, unitless pixels, Figma weight names, percentages, the legacy `value`/`type` format and `.value` references are read; math and references inside values (`{space.base} * 2`, `roundTo(…)`, `rgba({color.black}, 0.5)`) are evaluated per mode. `transtyle explain` names a token's set file and Tokens Studio path, per mode, and a math token's expression. New diagnostics `TST1003`–`TST1009` cover a broken export, an unmapped theme group, the legacy format, an expression outside the supported subset, a color modifier (refused: the plugin would output a different color), themes that per-mode layers cannot express, and lossy readings. Projects without this layer compile exactly as before.

- 5411cc9: Report `TST1113` when a `semantic.*` token aliases a `component.*` token.

  The tiers layer option, semantic, component, and the semantic tier is the stable surface the component tier reads from; an alias pointing the other way inverts that and was silently accepted. It is now an error naming both tokens, with a hint, and nothing is emitted. Only the direct edge is reported (`semantic.a` to `semantic.b` to `component.c` names `semantic.b`), and `component` to `semantic` or `component` aliases are unaffected. No example authors such an alias, so existing builds do not change. `check:component-tier` covers the error, the chain and the legitimate layering; `check:plugins` and `check:minimal-ds` now also fail an exporter whose coverage binds an `option.*` slot.

### Patch Changes

- 745c6fd: A role whose `.solid` is an alias to a slot the engine derives now gets its full grid.

  Binding `semantic.color.secondary.solid` to `{semantic.color.info.solid}` (or to another role's derived cell, like `{semantic.color.primary.solid-hover}`) resolved to the right colour, but the role's hover, tint, outline, on-colours and text cells were never derived, and nothing said so. DERIVE now reads such an alias as soon as its target exists, and retries a role whose target comes later in role order, so the grid is derived whatever the order. The same fix materializes component slots whose semantic source is bound to a derived scale step (`semantic.radius.control: "{semantic.radius.full}"` now gives `component.button.radius`). An archetyped role bound this way no longer raises `TST1203` ("no authored `.solid`"). A binding to a slot derived too late to feed it (a role bound to `ring`, `link.*` or `palette.categorical.*`, or `text.base` bound to a role cell) still resolves, and the new warning `TST1205` names what was not derived. Design systems that alias no derived slot compile exactly as before.

- 686bf5f: Make EMIT atomic: a failed build no longer leaves a half-written output.

  Every exporter now runs before anything is written. The files of all targets are then staged next to their output directories (`<output>.transtyle-tmp/`) and renamed into place, and if any step fails the swap is rolled back, so each output directory is exactly what it was before the build. Previously an exporter that threw on the second target, or an error-level diagnostic raised by it, left the first target's files updated and the rest stale. Files in an output directory that the build did not produce are still never touched. Output bytes are unchanged.

- 69dd3fb: Parse authored DTCG composites member by member.

  An authored `shadow` such as `elevation.1.shadow` used to reach the exporters with its `color` still a string, and css-variables shipped `oklch(NaN NaN NaN)` without a diagnostic. NORMALIZE now parses `shadow`, `typography`, `border` and `transition` members by their DTCG types: colors become OKLCH, member aliases resolve per mode (after DERIVE when they name a derived slot such as `{semantic.color.scrim}`), and a malformed or missing member is `TST1106` under its own path (`semantic.color.elevation.1.shadow.color`). A `shadow` may be an array of layers, with `inset`.

  css-variables and PrimeNG render stacked and inset shadows; css-variables renders authored `border` and `transition` composites as their CSS shorthands. `transtyle explain` lists an authored composite's members and the alias each came through.

- 3bab610: Round contrast ratios down in `TST2101` and in `transtyle diff`'s contrast lines, so a pair just under its threshold no longer prints as the threshold itself.

  A ratio of 4.47 against a 4.5 minimum used to read `4.5:1 (< 4.5:1)`; it now reads `4.4:1 (< 4.5:1)`, the same direction `transtyle init`'s closing swatch already rounds.

- 86cf5e4: Accept the DTCG structured value forms instead of writing `[object Object]` into stylesheets.

  A `dimension` or `duration` authored as `{ "value": 16, "unit": "px" }`, a `cubicBezier` authored as `[0.2, 0, 0, 1]`, and a `fontWeight` authored as a DTCG keyword such as `"semi-bold"` used to reach every exporter as a JavaScript value: six targets wrote `[object Object]` (or `0.2,0,0,1`, or `semi-bold`), Storybook and ECharts dropped the value, and an object-form `radius.md` broke the derived radius scale with a misleading `TST1105` — all without a diagnostic. NORMALIZE now canonicalizes these forms, also as members of `typography`, `shadow`, `border` and `transition` composites, to the CSS string exporters already read (`16px`, `cubic-bezier(0.2, 0, 0, 1)`, `600`), so both authoring forms compile byte-identical on every target and the IR value contract exporters see is unchanged. A malformed structured value (no unit, an unknown unit, a non-number `value`, a bare non-zero number for a dimension, an unknown weight keyword) now stops the build with `TST1106` and a hint naming the accepted forms. CSS strings are carried as authored, exactly as before.

  The plugin-kit fixture authors its radius, a duration and an easing in the structured form, so conformance runs prove a plugin receives the CSS string.

- 0ca2c0c: Export `buildReport()` from `@transtyle/core`.

  The function that builds a target's `report.json` object now lives in `packages/core/src/report.js` and is public: `buildReport({ target, options, coverage, reads, normalized, diagnostics, suppressed, files })` returns the object `transtyle build` writes (with `normalized`, rows carry their slot's `$description` and `$deprecated`), so a tool that compiles with `emit: false` gets the same report without writing files. `compile()` uses it; the reports it writes are unchanged. `REPORT_SCHEMA_ID` is exported with it. The package README's example, which read a `result.report` that `compile()` never returned, now builds a report this way.

- 84e5387: Export `explainToken()` from `@transtyle/core`.

  The provenance walk behind `transtyle explain` now lives in core as `explainToken(normalized, slot, { mode })`, returning a JSON-serialisable tree (`{ slot, mode, entry, inputs }`) and throwing an `Error` with a `code` of `unknown-mode` or `unknown-slot`. The CLI is now a formatter over it; its output is unchanged.

- cd3022b: Name the target when an exporter throws, instead of printing only the exception message and exiting 2.

  A throw in an exporter's `emit` is now a `TST3001` error (`Exporter "bootstrap" crashed in emit: <message>`), and an exporter that cannot be loaded is `TST3002`. The other targets still run, so every crash is reported at once, nothing is written to disk, and the run exits 1 like any error. `TRANSTYLE_DEBUG=1` prints the stack. `transtyle explain` no longer runs the exporters at all.

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- e561de6: A `tokens` glob that also matches a mode-scoped overlay no longer loads that file as a base layer.

  With `["tokens/*.tokens.json", { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }]`, `dark.tokens.json` was loaded twice: as the dark overlay, and as one more base layer. Its dark values overwrote the light ones, and every token in it raised `TST1103`. The overlay now claims its file whatever the order of the entries, so the glob skips it: light mode keeps the base values, and the `TST1103` warnings go away. Configs that list their base files one by one compile exactly as before.

- af6e510: Alias chains of any length resolve, and large design systems no longer hit quadratic slow paths.

  An alias chain of about 4,500 links used to crash `transtyle check` and `build` with `Maximum call stack size exceeded` (exit 2, no diagnostic code, no token named): the resolver recursed once per link. Chains are now walked in a loop (and so is the walk that finds deprecated tokens a slot reaches), so any length resolves, with the same values, provenance and diagnostics as before. Four steps that grew faster than linearly are now linear: the out-of-sRGB check (`TST1120`) followed every chain again from each token on it (a 10,000-link chain took 50 s), a long alias loop was walked once per member before its `TST1104` (a 10,000-link loop took minutes), and duplicate option values (`TST1115`) were grouped by comparing each token with every group so far. The Mantine exporter matched every emitted colour variable against every palette name, so 500 custom roles cost it 1.5 s; it now looks each name up. A 10,000-token design system with four mode combinations now compiles every target in under a second on a laptop.

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- 6eeb154: Compile large design systems faster: core no longer redoes the same work for every target.

  Recording which slots each exporter reads used to copy every mode map before each target ran. The recording now reads the original maps, and an exporter that writes to its view still writes to its own copy. The list of custom `semantic.*` tokens was rebuilt and sorted twice per target; it is now built once per compile. On a 10,000-token design system with four mode combinations, a compile with every exporter takes about a third less time, and about 40% less with long alias chains. Every output is unchanged.

- ed1445d: Treat token groups and binding slots named after built-in object properties as ordinary names, and parse colors in linear time.

  A group called `constructor` or `toString` was merged into the property every JavaScript object already has under that name; it now merges like any other group, in token layers and in `bindings` alike. Color strings (`rgb()`, `oklch()`, `color()` and the rest) and the Bootstrap exporter's reading of trailing comments on dropped declarations now take time proportional to their length. Valid colors parse to the same values, and every example builds to the same output.

- de5392a: `semantic.radius.none` is now derived, as the IR catalog always specified.

  The F8 radius ramp filled `sm`, `lg`, `xl` and `full` from an authored `semantic.radius.md` but never `none`, so a design system that didn't author it had no zero step and css-variables emitted no `--radius-none`. DERIVE now fills it with `0` in `radius.md`'s unit (`0rem` for `0.5rem`, `0px` for `6px`). An authored `radius.none` still wins, and a design system without `radius.md` derives no radius at all, as before.

- 5a97fd4: Name Style Dictionary v3 token files instead of loading them as empty.

  A token file that uses `value`/`type` without the `$` prefix (the Style Dictionary v3 format) has no DTCG token in it, so it used to compile to an empty tree and end with `TST1201 semantic.color.primary.solid is not authored`, plus a `TST1305` warning per top-level group, without ever naming the format as the cause. LOAD now recognizes a file with `value` leaves and no `$value` anywhere and reports one `TST1307` error per file, naming the file and the first legacy token, with a hint on the renames to make (`value` → `$value`, `type` → `$type`, `comment` → `$description`, `{a.b.c.value}` → `{a.b.c}`). The `TST1201` and `TST1305` noise for that file is gone. Its hint points at `transtyle migrate --from style-dictionary`, which does the renames.

- 76b973a: Stop reporting `TST1204` (dark-mode carry-over) for a role whose `.solid` never resolved.

  When `semantic.color.primary.solid` was a dangling alias (`TST1105`), part of an alias cycle (`TST1104`) or an unparseable colour (`TST1106`), the build printed the error and, next to it, an info note saying the light-mode value "carries over unchanged" into dark. There was no light-mode value: the comparison found `undefined` equal to `undefined`. The note is now skipped when the default-mode value is missing, so only the cause is reported, as for `TST1201`. `check:cli` covers all three cases against the `init` scaffold.

- Updated dependencies [dc79f14]
- Updated dependencies [abff3a3]
- Updated dependencies [305dd4e]
- Updated dependencies [5602f4a]
- Updated dependencies [e5bac21]
- Updated dependencies [ed1445d]
- Updated dependencies [a8afe0f]
- Updated dependencies [a786b21]
  - @transtyle/ir@0.1.0-alpha.4

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
  - @transtyle/ir@0.1.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- 16dc98d: Give every package a README, and point `homepage` at its documentation page.

  All twelve packages shipped `0.1.0-alpha.0` and `.1` with no README, so each rendered as a blank page on npmjs.com — the surface most people meet the project on, and the only one nobody working in the repo ever reopens. Each now says what it emits, how to use it, and that it is an experimental alpha, and links into the documentation site rather than at the monorepo root.

  `@transtyle/exporter-primeng`'s description also claimed it was "not yet registered in the CLI". It has been since C6; the sentence was published to npm twice after it stopped being true.

  `check:manifests` grew two checks for the class: a package must have a README that is more than a stub, and a `homepage` naming a docs page must name one that exists — a 404 baked into published metadata cannot be fixed without another release.

- Updated dependencies [16dc98d]
  - @transtyle/ir@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- @transtyle/ir@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- First public alpha.

  Transtyle compiles a framework-agnostic description of a design system — DTCG tokens plus semantics and modes — into native theme artifacts for eight targets: Bootstrap, shadcn/ui, daisyUI, Apache ECharts, Storybook, Radix Colors/Themes, PrimeNG, and plain CSS variables. Unauthored values are filled by deterministic, inspectable derivation rules rather than hidden defaults, every generated value carries provenance you can query with `transtyle explain`, and every build emits a coverage report saying what mapped natively, what was derived, what was approximated, and what the target cannot express.

  All three token tiers — raw/option, semantic and component — are mapped on the two component-heavy targets, Bootstrap and PrimeNG, each measured against a checked-in inventory of the target's real theming surface so gaps are reported rather than quietly skipped.

  Import is DTCG only in this release. Tailwind, Figma and CSS-custom-property importers are post-alpha.

  **This is an experimental alpha.** Breaking changes ship without a deprecation cycle: the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases, and none of it carries a stability or support promise. Pin an exact version, and treat generated files as disposable output you regenerate rather than hand-edit. The reasoning is recorded in ADR-0010; the release process is documented in RELEASING.md.

### Patch Changes

- Updated dependencies
  - @transtyle/ir@0.1.0-alpha.0
