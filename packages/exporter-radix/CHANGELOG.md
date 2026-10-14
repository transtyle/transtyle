# @transtyle/exporter-radix

## 0.1.0-alpha.4

### Minor Changes

- a8afe0f: The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

  CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.

### Patch Changes

- 5602f4a: Make the packages findable on npm.

  All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

  Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.

- e5bac21: Put the project's logo on every package page.

  Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

  The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.

- 7eab225: Name the slots behind each ramp coverage row.

  Every `--<role>-<step>` and `--<role>-a<step>` row now carries a `slots` field with the role cells and elevation surfaces its step is computed from (step 6 reads the role's `solid` and `elevation.1.surface`, step 9 reads `solid`, and so on), and the `--gray-*` row lists the neutral cells. The `slot` label (`semantic.color.<role>.*`) is unchanged. `transtyle explain --variable <Radix step variable> --target radix` now prints the role cells and their provenance, and the slot matrix records them as named reads. The emitted CSS is unchanged.

- 898bded: The daisyUI `--depth / --noise / --size-*` coverage row and the Radix `(P3/wide-gamut variants)` row are now `unsupported` instead of `dropped`, each with a meaning key (`style.effect`, `color.wide-gamut`), so they count as catalog-growth evidence in the catalog-signals report.
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
