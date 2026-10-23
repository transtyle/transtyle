# @transtyle/ir

## 0.1.0-alpha.5

### Minor Changes

- c345e51: The TypeScript targets write a slot's `$description` and `$deprecated` as JSDoc.

  Chakra, Mantine, PrimeNG, MUI and Storybook put a `/** … */` block above each property that maps exactly one slot, and ECharts does the same in its `.js` theme (the `.json` twin takes no comments). The description shows on hover in an editor, and `@deprecated <reason>` strikes the property through. Radix writes the same text as a `/* … */` comment above each variable that is exactly one grid cell. A property computed from several slots, or from a derived one, gets no comment, and a `*/` in a description is broken up so the file still parses. `@transtyle/ir` exports `jsdocComment()`, `Documented`, `withDoc()` and `withoutDocs()` for exporters that print an object tree.

- 511e2d2: The catalog gains the focus ring's geometry: `semantic.ring.width` and `semantic.ring.offset`, two scalars next to `semantic.color.ring` (proposal 0002, row 8, #167).

  The width defaults to `{semantic.border-width.medium}` (2px) and the offset to 2px. There is no style and no shadow slot, and no composite: every outline-family library draws a solid ring, and Chakra UI, Material UI, Adobe Spectrum and Material 3 all publish the width and the offset as separate values. The targets write them only when you author them (the width itself, or through `border-width.medium`), so a design system that doesn't keeps each library's own ring: PrimeNG's `focusRing.width` and `.offset`, Chakra's `--focus-ring-width` and `--focus-ring-offset` on `<html>` (every `focusVisibleRing` variant reads them), Material UI's `focusVisible.outlineWidth` and `.outlineOffset`, and Bootstrap's `$focus-ring-width` (its ring is a box-shadow halo with no gap, so the offset is reported `dropped`). The css-variables target writes `--ring-width` and `--ring-offset` for everyone. Mantine, daisyUI, Radix Themes and shadcn/ui draw their rings in component CSS and report both slots `dropped`. The GOV.UK example authors its 3px `$govuk-focus-width`, so its PrimeNG, Chakra, Material UI and Bootstrap themes now draw a 3px ring.

  `isAuthored(map, path)` in `@transtyle/ir` is the test the exporters share: `authored` or `aliased`, or an `alias(<slot>)` default of a slot the design system authored. `transtyle catalog` lists 266 slots.

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

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

- a786b21: Carry DTCG `$description` and `$deprecated` through to the outputs.

  Both fields used to load and then disappear. A token's `$description` is now written as a comment line above its variable in css-variables, shadcn and daisyUI (and above Bootstrap's `$primary…$danger`), added as `description` to the matching items of every `report.json`, and printed by `transtyle explain` under the value line. `$deprecated` (`true` or a reason, inherited from its group, `false` to opt out) reaches the same places, and a semantic or component slot whose value still comes from a deprecated token warns `TST1122` with the reason as the hint; every target's `usage.md` lists those variables under "Deprecated tokens", and their report items carry `deprecated` and `deprecatedBy`. A `$description` that isn't a string, or a `$deprecated` that isn't `true`, `false` or a string, warns `TST1311` and is ignored. Design systems that describe their tokens (GOV.UK and Carbon among the examples) see new comment lines in those files; nothing else changes. Exporter authors read `entry.description` and `entry.deprecated`, with `entryNotes()`, `blockComment()` and `lineComment()` from `@transtyle/ir`.

### Patch Changes

- 305dd4e: Accept a `fontFamily` written as one string, and list every diagnostic of a build in every `report.json`.

  A `fontFamily` token (or a `typography` member) authored as a CSS list in one string, `"Inter, system-ui, sans-serif"`, which DTCG allows, crashed the shadcn, ECharts, Bootstrap and Storybook exporters with `TST3001`. NORMALIZE now splits it into the array of names exporters read, so both forms compile to the same bytes on every target; a quoted name (`'Helvetica Neue'`) loses its quotes like the array form, a `var(…)` stays whole, and an empty name or a non-string entry is `TST1106`. `@transtyle/ir` exports the two helpers the official exporters now share, `fontNames()` and `fontStack()`, for third-party exporters that read font families.

  Each target's `report.json` was serialised as soon as that target ran, so a diagnostic an exporter raised for a later target (shadcn's `TST2104`) was missing from the earlier targets' reports. Reports are now built after the last target, from the final list, and `check.suppress` runs at that point too: an exporter's own diagnostic can be suppressed like any other, where a rule for it used to match nothing (`TST1012`) and leave it printed.

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- ed1445d: Treat token groups and binding slots named after built-in object properties as ordinary names, and parse colors in linear time.

  A group called `constructor` or `toString` was merged into the property every JavaScript object already has under that name; it now merges like any other group, in token layers and in `bindings` alike. Color strings (`rgb()`, `oklch()`, `color()` and the rest) and the Bootstrap exporter's reading of trailing comments on dropped declarations now take time proportional to their length. Valid colors parse to the same values, and every example builds to the same output.

## 0.1.0-alpha.3

### Patch Changes

- 3d71e2f: Ship `CHANGELOG.md` in every published package.

  npm always includes `README` and `LICENSE` regardless of the `files` allowlist, but not the changelog — so the first three alphas published with no version history at all, on the one page a stranger reads to decide whether upgrading is safe. Changesets has been writing the file since `0.1.0-alpha.0`; only the allowlist was keeping it in the repo.

  `check:manifests` now requires it, so a package added later cannot quietly ship without one.

- af10209: Ship the MIT licence text in every published package.

  npm adds a `LICENSE` file to a tarball only when one sits in the package directory. Only the monorepo root had one, so the first three alphas published twelve packages that each declared `"license": "MIT"` without carrying the text those terms ask to be distributed with them.

  Each package now holds a copy, and `check:manifests` requires it to be byte-identical to the root one — twelve copies of a licence being exactly the sort of thing that drifts a copyright year with nobody noticing.

## 0.1.0-alpha.2

### Patch Changes

- 16dc98d: Give every package a README, and point `homepage` at its documentation page.

  All twelve packages shipped `0.1.0-alpha.0` and `.1` with no README, so each rendered as a blank page on npmjs.com — the surface most people meet the project on, and the only one nobody working in the repo ever reopens. Each now says what it emits, how to use it, and that it is an experimental alpha, and links into the documentation site rather than at the monorepo root.

  `@transtyle/exporter-primeng`'s description also claimed it was "not yet registered in the CLI". It has been since C6; the sentence was published to npm twice after it stopped being true.

  `check:manifests` grew two checks for the class: a package must have a README that is more than a stub, and a `homepage` naming a docs page must name one that exists — a 404 baked into published metadata cannot be fixed without another release.

## 0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- First public alpha.

  Transtyle compiles a framework-agnostic description of a design system — DTCG tokens plus semantics and modes — into native theme artifacts for eight targets: Bootstrap, shadcn/ui, daisyUI, Apache ECharts, Storybook, Radix Colors/Themes, PrimeNG, and plain CSS variables. Unauthored values are filled by deterministic, inspectable derivation rules rather than hidden defaults, every generated value carries provenance you can query with `transtyle explain`, and every build emits a coverage report saying what mapped natively, what was derived, what was approximated, and what the target cannot express.

  All three token tiers — raw/option, semantic and component — are mapped on the two component-heavy targets, Bootstrap and PrimeNG, each measured against a checked-in inventory of the target's real theming surface so gaps are reported rather than quietly skipped.

  Import is DTCG only in this release. Tailwind, Figma and CSS-custom-property importers are post-alpha.

  **This is an experimental alpha.** Breaking changes ship without a deprecation cycle: the token vocabulary, the generated output, the config format and the CLI surface can each change between alpha releases, and none of it carries a stability or support promise. Pin an exact version, and treat generated files as disposable output you regenerate rather than hand-edit. The reasoning is recorded in ADR-0010; the release process is documented in RELEASING.md.
