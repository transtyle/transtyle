# @transtyle/plugin-kit

## 0.1.0-alpha.5

### Patch Changes

- Updated dependencies [f790c6a]
- Updated dependencies [511e2d2]
- Updated dependencies [864b0a6]
  - @transtyle/core@0.1.0-alpha.5

## 0.1.0-alpha.4

### Minor Changes

- dc79f14: Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

  Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1126`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

  Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

  A token that has both a `$value` and child tokens is now an error (`TST1314`), as DTCG requires; its children used to be dropped silently.

  `transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.

- 6f8196e: Custom semantic tokens (your own `semantic.*` names outside the catalog) are now accounted for on every target. After each exporter runs, core sorts them into the ones the target writes under their own name, the ones that reach it through a catalog slot bound to them, and the ones with no path, which get a `dropped` coverage row named `(custom:<path>)` with the meaning `custom.vocabulary`. `report.json` carries the counts as `coverage.customVocabulary`, `usage.md` gains a "Custom vocabulary" section, and the build prints `custom vocabulary: 14 tokens, 10 reach this target via bindings, 4 have no path` under the target's bar, whose percentages leave these rows out. Core exports `customTokens()` (the same definition as the adoption report's) and passes the list to exporters as `ctx.customTokens`.

  An exporter can declare `openVocabulary: true` when its target takes any variable name. css-variables already wrote every custom token and now declares it; daisyUI now writes them into its theme blocks too (`semantic.color.crt.ink` → `--color-crt-ink`). Both accept `options.customTokens: "omit"` to leave them out. plugin-kit gains a `custom-vocabulary` fixture and three checks for open-vocabulary exporters.

  The Bootstrap exporter reports `$spacer`, `$font-size-base` and `$line-height-base` on rows of their own, with their exact slot, so `transtyle explain --variable '$btn-line-height' --target bootstrap` now ends at `semantic.type.leading.normal` (Acme: 714 rows become 717). The PrimeNG exporter reports its content text colours (`text.color`, `text.mutedColor` and their hover twins), which it already emitted (Acme: 356 rows become 360).

- 0ae9eb5: A JSON mapping table can now be an exporter, and a target can name the framework version it is built for.

  **Declarative exporters.** Point a target at a mapping file next to the config (`"exporter": "./ourlib.mapping.json"`): rows of `{ variable, slot, part?, format?, class?, note? }` in CSS custom properties, Sass, Less or JSON files, with selector blocks per mode value. Core runs it like any exporter and derives the coverage report from the rows; no code runs. A package can ship a mapping instead of code (`"transtyle": { "declarative": "mapping.json", … }`): the CLI reads it and never imports the package. A malformed mapping is `TST1014`, a row naming an unknown slot `TST1015`; the format is published as `schemas/mapping/v0.json`. `@transtyle/core` exports `createDeclarativeExporter`, `validateMapping`, `loadDeclarativePackage` and friends, so `conformance(createDeclarativeExporter(mapping))` tests a mapping like any plugin.

  **Version profiles.** `targets.<t>.version: "5.3.8"` selects the exporter manifest range that covers it; the exporter gets `ctx.targetVersion` and `ctx.targetProfile`, and `report.json` records `version: { requested, profile }`. A version outside every range is `TST1313`. shadcn's manifest now declares Tailwind ranges (`>=3 <4`, `>=4 <5`) instead of era names, so `"version": "3.4.17"` selects the tailwind-v3 output; `options.era` still wins when set, with a `TST2105` warning if the two disagree. plugin-kit's new `manifest-targets-ranges` check rejects a `targets` entry that isn't a version range. Without `version`, output is unchanged.

  **css-variables** now writes `palette.categorical.*` in its dark block too; its dark values were missing.

- c26f347: `transtyle explain` now goes both ways. `explain --variable '$btn-border-radius' --target bootstrap` starts from a target variable, follows the variables it is chained to, and explains each slot it reaches; `explain <slot> --target <t>` lists the target's variables that consume a slot. Both work without a prior build, and `--json` prints the data. The provenance tree now follows aliases to their target, so it always ends at what was authored. Core exports the lookups as `explainVariable()`, `slotConsumers()` and `coverageSlots()`; `explainToken()` lists an aliased entry's target as its one input.

  Coverage rows gain two optional fields, `slots` (the IR paths a variable reads, when its `slot` label isn't one) and `via` (the variables it follows), declared in the report schema; plugin-kit's conformance suite checks that every `slots` entry exists in the IR. The Bootstrap exporter fills them for its chained, `var(--bs-*)`, member and transition rows, and the PrimeNG exporter reports its form-field, button and typography rows one variable per row (Acme: 349 rows become 356).

- 10f61c6: Refuse an exporter built for another IR spec or plugin API, with a diagnostic that says which and what to install, instead of letting it fail in whatever way its code happens to.

  The CLI now reads each exporter's `transtyle` manifest from its `package.json` and core checks it before running the exporter: `pluginApi` is a semver range that must accept the plugin API version core implements (`0.0.0`, so `"0"` or `"^0"`), and `irSpec` must be `"v0-draft"`. A mismatch is a `TST1309` error naming the target, the package, its version, what it declares and what core provides; every target is checked in the same run and nothing is written. An exporter package without a manifest still loads, with a `TST1310` warning. All official exporters already declare matching values.

  `@transtyle/core` exports `checkPluginCompat(manifest)` and `PLUGIN_API_VERSIONS`; a custom `loadExporter` passed to `compile()` opts into the check by returning `{ plugin, manifest, package: { name, version } }` (returning the plugin itself still works, unchecked). `@transtyle/plugin-kit` adds a `manifest-compatible` conformance check, run when `{ manifest }` is given, so a wrong value fails an exporter's own CI first.

- 053f796: `conformance()` accepts the optional `diagnostics` an exporter may return from `emit()`: a new `emit-diagnostics-valid` check (only when the plugin returns some) requires `{ severity: 'info' | 'warning', code, message, hint? }`, and `deterministic` now compares diagnostics as well as files. The README's usage example now reads the real return value (`{ pass, checks }`).
- f05d526: `conformance()` now runs your exporter against nine fixture design systems instead of one: the canonical one, plus one token, three tokens, `color-scheme` × `density`, light only, an authored component tier, a custom archetyped role, authored composites and DTCG object forms. Five checks join the suite: `files-non-empty`, `no-leaked-values` (no `undefined`, `null`, `NaN` or `[object Object]` in a file), `coverage-honest` (no `native`/`derived` row for a slot that has no value), `mode-dimensions-accounted` (a `density` mode is emitted or reported as a `(mode:density)` `dropped` row) and `structured-values-as-strings` (object-form tokens give the same files as their CSS strings). Every per-IR check now carries the `fixture` it ran on.

  This can fail an exporter that passed before. The common one is an exporter that compiles a single mode: add a `dropped` coverage row named `(mode:<dimension>)` for each dimension in `ir.dimensionNames` it does not follow. Pass `{ fixtures: 'canonical' }` to keep the old single-fixture run while you fix it, or an array of fixture names. `fixtureIR(name)` takes a fixture name (default `canonical`), `FIXTURES` lists them, and the leak patterns are exported as `LEAK` and `LEAK_INSIDE`. The bundled fixture moved from `fixture/` to `fixtures/canonical/`.

- f7cfa4b: `conformance()` has a new `no-reserved-file-names` check: an exporter file named `report.json` or `transtyle-manifest.json` fails it, since core writes both in every target's output directory after the exporter's files and would silently overwrite it.

### Patch Changes

- 6b67f2a: Add a config-level `rem` base: `"units": { "remBase": "10px" }` (default `"16px"`, so existing output does not change). Exporters that convert `rem` to pixels read it through the new `ctx.units` (`toPx`, `toRem`, `remBase`): ECharts used a fixed 16 and its `approximated` note now names the configured base; Storybook uses it unless its own `options.remBase` is set. A base that is not a positive `px` length is a `TST1010` error.
- c2f8cfb: Accept DTCG color objects, the color form design tools export: `{ "colorSpace": "srgb", "components": [0, 0.43, 0.84], "alpha": 1, "hex": "#026fd7" }` used to stop the build with `TST1106 Not a color string`. All fourteen DTCG color spaces are read (`srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`), at the top level, per mode, in layer files and as composite members, and the `hwb()`, `lab()`, `lch()`, `oklab()` and `color(<space> …)` CSS syntaxes now parse through the same converter (`oklch()` also takes `none`, angle units and a percentage chroma). An `srgb` object compiles to the same bytes as its hex, and a wide-gamut color keeps its chroma (`TST1120` names the sRGB fallback hex and HSL targets ship). For `srgb`, a `hex` within 0.01 per channel of the components wins, so two-decimal exports ship the designer's exact color; one further off loses to the components with a new `TST1123` warning. A malformed object (unknown `colorSpace`, not three components, `alpha` outside 0–1, a `hex` that isn't `#rrggbb`) is `TST1106` with a hint listing the accepted forms. `transtyle explain` prints the authored object (`└─ authored as {…}`), and the plugin-kit `object-form` fixture now authors its colors as DTCG objects too.
- 86cf5e4: Accept the DTCG structured value forms instead of writing `[object Object]` into stylesheets.

  A `dimension` or `duration` authored as `{ "value": 16, "unit": "px" }`, a `cubicBezier` authored as `[0.2, 0, 0, 1]`, and a `fontWeight` authored as a DTCG keyword such as `"semi-bold"` used to reach every exporter as a JavaScript value: six targets wrote `[object Object]` (or `0.2,0,0,1`, or `semi-bold`), Storybook and ECharts dropped the value, and an object-form `radius.md` broke the derived radius scale with a misleading `TST1105` — all without a diagnostic. NORMALIZE now canonicalizes these forms, also as members of `typography`, `shadow`, `border` and `transition` composites, to the CSS string exporters already read (`16px`, `cubic-bezier(0.2, 0, 0, 1)`, `600`), so both authoring forms compile byte-identical on every target and the IR value contract exporters see is unchanged. A malformed structured value (no unit, an unknown unit, a non-number `value`, a bare non-zero number for a dimension, an unknown weight keyword) now stops the build with `TST1106` and a hint naming the accepted forms. CSS strings are carried as authored, exactly as before.

  The plugin-kit fixture authors its radius, a duration and an easing in the structured form, so conformance runs prove a plugin receives the CSS string.

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- Updated dependencies [d2f15d2]
- Updated dependencies [745c6fd]
- Updated dependencies [f7e1649]
- Updated dependencies [686bf5f]
- Updated dependencies [69dd3fb]
- Updated dependencies [053f796]
- Updated dependencies [e907c95]
- Updated dependencies [021dbf9]
- Updated dependencies [dc79f14]
- Updated dependencies [c05fa2b]
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
- Updated dependencies [8418bec]
- Updated dependencies [c26f347]
- Updated dependencies [0ca2c0c]
- Updated dependencies [84e5387]
- Updated dependencies [cd3022b]
- Updated dependencies [305dd4e]
- Updated dependencies [e561de6]
- Updated dependencies [90c4e67]
- Updated dependencies [ad980e8]
- Updated dependencies [af6e510]
- Updated dependencies [8c241d5]
- Updated dependencies [4c65ad3]
- Updated dependencies [e7d4c3c]
- Updated dependencies [0e0fb68]
- Updated dependencies [5602f4a]
- Updated dependencies [e5bac21]
- Updated dependencies [6eeb154]
- Updated dependencies [ed1445d]
- Updated dependencies [10f61c6]
- Updated dependencies [de5392a]
- Updated dependencies [a8afe0f]
- Updated dependencies [5a97fd4]
- Updated dependencies [c5c76ed]
- Updated dependencies [570b458]
- Updated dependencies [a786b21]
- Updated dependencies [e3bc8bc]
- Updated dependencies [7167ab0]
- Updated dependencies [5411cc9]
- Updated dependencies [76b973a]
  - @transtyle/core@0.1.0-alpha.4

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

## 0.1.0-alpha.2

### Patch Changes

- 16dc98d: Give every package a README, and point `homepage` at its documentation page.

  All twelve packages shipped `0.1.0-alpha.0` and `.1` with no README, so each rendered as a blank page on npmjs.com — the surface most people meet the project on, and the only one nobody working in the repo ever reopens. Each now says what it emits, how to use it, and that it is an experimental alpha, and links into the documentation site rather than at the monorepo root.

  `@transtyle/exporter-primeng`'s description also claimed it was "not yet registered in the CLI". It has been since C6; the sentence was published to npm twice after it stopped being true.

  `check:manifests` grew two checks for the class: a package must have a README that is more than a stub, and a `homepage` naming a docs page must name one that exists — a 404 baked into published metadata cannot be fixed without another release.

- Updated dependencies [16dc98d]
  - @transtyle/core@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- @transtyle/core@0.1.0-alpha.1

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
