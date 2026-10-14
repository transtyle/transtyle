# @transtyle/exporter-primeng

## 0.1.0-alpha.4

### Minor Changes

- dc79f14: Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

  Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1126`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

  Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

  A token that has both a `$value` and child tokens is now an error (`TST1314`), as DTCG requires; its children used to be dropped silently.

  `transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.

- c26f347: `transtyle explain` now goes both ways. `explain --variable '$btn-border-radius' --target bootstrap` starts from a target variable, follows the variables it is chained to, and explains each slot it reaches; `explain <slot> --target <t>` lists the target's variables that consume a slot. Both work without a prior build, and `--json` prints the data. The provenance tree now follows aliases to their target, so it always ends at what was authored. Core exports the lookups as `explainVariable()`, `slotConsumers()` and `coverageSlots()`; `explainToken()` lists an aliased entry's target as its one input.

  Coverage rows gain two optional fields, `slots` (the IR paths a variable reads, when its `slot` label isn't one) and `via` (the variables it follows), declared in the report schema; plugin-kit's conformance suite checks that every `slots` entry exists in the IR. The Bootstrap exporter fills them for its chained, `var(--bs-*)`, member and transition rows, and the PrimeNG exporter reports its form-field, button and typography rows one variable per row (Acme: 349 rows become 356).

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

### Patch Changes

- 69dd3fb: Parse authored DTCG composites member by member.

  An authored `shadow` such as `elevation.1.shadow` used to reach the exporters with its `color` still a string, and css-variables shipped `oklch(NaN NaN NaN)` without a diagnostic. NORMALIZE now parses `shadow`, `typography`, `border` and `transition` members by their DTCG types: colors become OKLCH, member aliases resolve per mode (after DERIVE when they name a derived slot such as `{semantic.color.scrim}`), and a malformed or missing member is `TST1106` under its own path (`semantic.color.elevation.1.shadow.color`). A `shadow` may be an array of layers, with `inset`.

  css-variables and PrimeNG render stacked and inset shadows; css-variables renders authored `border` and `transition` composites as their CSS shorthands. `transtyle explain` lists an authored composite's members and the alias each came through.

- c08ff37: Coverage rows can say what an `unsupported` slot is missing: `report.json` rows accept an optional `meaning` key (`"icon.size"`, `"icon.asset"`), shared across exporters so the same missing concept can be counted wherever it shows up. Bootstrap's 56 `unsupported` rows and ECharts' one now carry it.

  PrimeNG's coverage no longer counts its own primary ramp as left on Aura's default: the eleven `primary.*` steps it emits are reported as driven (Acme: 89 driven, 1104 on Aura's default, was 78 and 1115).

- 6f8196e: Custom semantic tokens (your own `semantic.*` names outside the catalog) are now accounted for on every target. After each exporter runs, core sorts them into the ones the target writes under their own name, the ones that reach it through a catalog slot bound to them, and the ones with no path, which get a `dropped` coverage row named `(custom:<path>)` with the meaning `custom.vocabulary`. `report.json` carries the counts as `coverage.customVocabulary`, `usage.md` gains a "Custom vocabulary" section, and the build prints `custom vocabulary: 14 tokens, 10 reach this target via bindings, 4 have no path` under the target's bar, whose percentages leave these rows out. Core exports `customTokens()` (the same definition as the adoption report's) and passes the list to exporters as `ctx.customTokens`.

  An exporter can declare `openVocabulary: true` when its target takes any variable name. css-variables already wrote every custom token and now declares it; daisyUI now writes them into its theme blocks too (`semantic.color.crt.ink` → `--color-crt-ink`). Both accept `options.customTokens: "omit"` to leave them out. plugin-kit gains a `custom-vocabulary` fixture and three checks for open-vocabulary exporters.

  The Bootstrap exporter reports `$spacer`, `$font-size-base` and `$line-height-base` on rows of their own, with their exact slot, so `transtyle explain --variable '$btn-line-height' --target bootstrap` now ends at `semantic.type.leading.normal` (Acme: 714 rows become 717). The PrimeNG exporter reports its content text colours (`text.color`, `text.mutedColor` and their hover twins), which it already emitted (Acme: 356 rows become 360).

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- 90c4e67: Compile without a filesystem: `compileProject()` and a browser entry, `@transtyle/core/browser`.

  `compileProject({ config, files, exporters })` takes the config and the token files as a map of paths to contents (JSON text, or parsed objects) and returns every target's files, `report.json` included, without writing anything. They are byte for byte what `transtyle build` writes. `@transtyle/core/browser` exports it with the rest of the API and reaches no Node built-in, so the compiler runs in a browser, a worker, an editor or a test. `compile({ cwd })` keeps its signature and results; it is now `loadProject(cwd)` → `compileProject()` → `writeResults(results, cwd)`, all three exported. Only the disk keeps two things: an `extends` chain (file paths: `loadProject()` and `compile()` follow and merge it, and pass `compileProject()` the merged config with `configChain` and `origins`, so diagnostics still name the file a key is in) and the emitted-file manifest with its drift check (`compile()` adds `transtyle-manifest.json` to the files it writes, and reports `TST1312` through `compileProject()`'s `checkOutputs` callback). `compileProject()` also takes `reports: false` to skip `report.json` when nothing will read it, as `compile({ emit: false })` does. The browser entry exports the custom-vocabulary helpers and `buildReport()` too. The Bootstrap, PrimeNG, Mantine and Chakra exporters import their `surface-inventory.json` as a JSON module instead of reading it from disk, so they load in a browser too.

  Small changes on the disk path: a `*` in the middle of a token glob now matches only directories and a final `*` only files (a directory matched by a final `*` used to fail with `TST1002`), a token file that can't be read reports `TST1002` as "no token file at this path" instead of Node's error with its absolute path, and `report.json` paths use `/` on every platform.

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- 1cb66fc: Restore Aura's dialog and popover padding shape in the PrimeNG preset.

  The exporter wrote the modal padding straight onto `dialog.header`, `dialog.content` and `dialog.footer` (and the popover padding onto `popover.content`), which replaced Aura's own definition. Aura reads `overlay.modal.padding` for the header and a top-less `0 p p p` shape for the content and footer, so the body sat under the header with two spacing steps instead of one, and again above the footer. The padding now goes where Aura reads it, `semantic.overlay.modal.padding` and `semantic.overlay.popover.padding`, and the per-part overrides are gone, so the dialog keeps Aura's layout at the token-driven size.

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
