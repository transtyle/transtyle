# Exporter spec: Bootstrap

**Why it's a reference exporter:** hardest constraint set of the four — a Sass-compiled theming system with a partial CSS-variable layer bolted on in 5.2/5.3, an opinionated color model (`$theme-colors` + generated `-bg-subtle`/`-border-subtle`/`-text-emphasis` derivations), and its own dark-mode mechanism (`data-bs-theme`). If the IR survives Bootstrap, most targets are easy.

## Compatibility

`"targets": { "bootstrap": [">=5.3 <6"] }` at launch (5.3 is where CSS-var theming and color modes stabilized). A `>=5.2 <5.3` profile may follow if demanded; Bootstrap 6 gets a new profile on release. Verify current Bootstrap state against its changelog before implementation.

## Emitted artifacts

Two consumption paths, because the Bootstrap community is split between Sass builds and CDN + overrides:

| File                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_variables.transtyle.scss` | Sass variable overrides (`$primary`, `$font-family-sans-serif`, `$border-radius`, spacer scale…) to import **before** Bootstrap — the idiomatic customization path; users keep Bootstrap's own build pipeline                                                                                                                                                                                                                                                             |
| `_maps.transtyle.scss`      | `$theme-colors` map merge + subtle/emphasis map overrides where our derived values should replace Bootstrap's own derivations                                                                                                                                                                                                                                                                                                                                             |
| `bootstrap-theme.css`       | Pure CSS-variable override layer (`--bs-primary`, `--bs-body-bg`, `--bs-border-radius`, + `[data-bs-theme=dark]` block) for no-Sass users — since AL1.4 it also drives the per-component `--bs-*` layer: selector-scoped structure blocks and button variant state colors from the role grid, both modes. Remaining, documented gap: values with no runtime variable (Sass-only expressions, responsive re-sets, state colors of components without per-variant CSS vars) |
| `usage.md`                  | Generated per-build: exact import order, which path to choose, coverage summary                                                                                                                                                                                                                                                                                                                                                                                           |

## Mapping strategy (highlights)

- Semantic color roles → `$primary…$danger` and the `$theme-colors` map: `native`.
- Role `subtle`/`contrast` values → `-bg-subtle`/`-text-emphasis` maps: `native`, and _we_ override Bootstrap's sRGB `tint-color()`/`shade-color()` derivations with our OKLCH-derived values (ours are perceptually consistent; classified `derived` when the source token was itself derived).
- `color-scheme` mode → `data-bs-theme="dark"` maps + CSS-var block: `native`. Other mode dimensions (density): `dropped` with reason — Bootstrap has no density concept.
- Typography roles → `$font-family-*`, `$font-size-base` + `$h*-font-size` from our type scale: `native`; `rem` conversion via config base: `approximated` if the base differs from Bootstrap's assumption.
- Spacing scale → `$spacer` + `$spacers` map: `native` when our scale is linear; `approximated` when a non-linear scale is flattened onto Bootstrap's map.
- Radius/shadows/borders → `$border-radius*`, `$box-shadow*`: `native`. Motion: Bootstrap themes almost none of it → mostly `dropped`.
- `unsupported` examples we must report honestly: Bootstrap's grid/breakpoint variables (no IR concept yet — breakpoints are a known catalog-candidate).

## Component theming (AL1, docs/plan/bootstrap-component-tier.md)

<!-- measured: bootstrap.surface.component = 657 -->
<!-- measured: bootstrap.surface.total = 952 -->
<!-- measured: bootstrap.classified.emit = 91 -->
<!-- measured: bootstrap.classified.chained = 284 -->
<!-- measured: bootstrap.classified.follows-global = 138 -->
<!-- measured: bootstrap.classified.inherits-driven = 22 -->
<!-- measured: bootstrap.classified.inherit-default = 18 -->
<!-- measured: bootstrap.classified.dropped = 51 -->
<!-- measured: bootstrap.classified.unsupported = 53 -->

The component-theming surface is measured by a checked-in inventory ([surface-inventory.json](../../../packages/exporter-bootstrap/surface-inventory.json), regenerated-and-diffed by `check:bootstrap-surface`): **657 component-scoped variables** across 49 families out of 952 total in `_variables.scss` (bootstrap@5.3.8); the 295 excluded are feature flags, palette definitions, and foundations scales, each with its reason in the file. The binding table lives in [descriptors.js](../../../packages/exporter-bootstrap/src/descriptors.js) — per-family data, zero per-variable logic, the PrimeNG descriptor pattern. Classification (completeness machine-enforced, and each count below re-derived from `coverageForVariable()` by `check:doc-numbers`): 91 bound to meanings (component slots, semantic slots, type-role members, transition recipes), 284 chained (Bootstrap's own `!default` expressions derive them from roots we drive), 138 following global `--bs-*` custom properties the semantic tier drives, 22 `inherits-driven`, 18 `null`/`inherit` cascade no-ops left untouched, 51 `dropped` (structure, derivation knobs, filters), 53 `unsupported` (real slots the IR can't express yet — itemized as catalog-growth data in [the cross-walk findings](../../findings/bootstrap-component-crosswalk.md)).

**`inherits-driven` — the correction the coverage bar earned on this side.** PrimeNG's bar counts a slot as covered when Aura's own default is a _reference_ into a semantic path we drive (`inherited`), because that is how PrimeNG is designed to be themed. Bootstrap has the identical mechanism in a different syntax: a `null` on an **inherited** CSS property means "emit no declaration", so the value that reaches the element is the ancestor's — and for 22 slots (`$card-subtitle-color`, `$input-btn-font-family`, `$nav-link-font-*`, `$toast-color`, …) that ancestor value is one this exporter drives, per mode, correctly. Classing those as `dropped` under-reported on Bootstrap exactly what we counted on PrimeNG. Membership is a per-name list in `descriptors.js`, never inferred from the marker, and it deliberately excludes the two shapes that look similar but aren't: **non-inherited** properties (`box-shadow`, `background`, `border-radius`, `height`, `margin`, `transition`, `filter`), where `null` means nothing reaches them at all, and **inherited-but-structural** properties (`white-space`, `cursor`), where the inherited value is real but is not a theme value. Anything unlisted keeps falling through to `dropped`, so a new upstream `null` is never silently claimed.

**Why overriding those slots would be worse, not better.** The obvious "win" — binding `$card-subtitle-color` to `semantic.color.text.muted`, `$input-disabled-color` to `text.disabled`, `$hr-border-color` to `color.border` — was implemented, then rejected. Those slots have no `--bs-*` counterpart, so the only path is Sass, which bakes one literal; the IR colors are mode-varying, so the baked light value would be wrong in dark mode, where inheritance from the driven `--bs-body-color` is right in both. Coverage would have gone up and the rendering would have gotten worse.

**The five contested calls** (full rationale in the findings doc): (1) the shared `$input-btn-padding-*` root binds to `component.button.padding-*`, so authoring button padding moves inputs too — Bootstrap's own coupling, documented, with a shared `field.*` slot as the AL2 resolution; (2) shade/tint/scale _derivation knobs_ are `dropped` — Transtyle drives derived _results_ (grid state cells) via the CSS-var path, never knob-to-knob; (3) em-relative paddings bind to rem rungs as `approximated`, trading proportional intent for themability; (4) `null` cascade markers are never overridden by default — and where the inherited value is one we drive, they are counted as coverage rather than dropped (see above), with two exceptions bound anyway because Bootstrap's own default is incoherent with the meaning it already carries: `$form-label-font-{size,weight}` (the IR's type roles say a label is its own role, and Bootstrap has the exact slots to say so) and `$legend-font-weight` (Bootstrap sets a 1.5rem legend but inherits body weight — a legend is a fieldset's title, so both members now come from `type.role.title.md`); (5) shape-identity numbers (radio `50%`, arrow geometry, float-label transform math) are structure, not theme.

## Ground-truth testing

CI compiles real Bootstrap (each supported minor) with our emitted Sass; asserts compilation succeeds and spot-checks resolved CSS custom-property values in the built stylesheet. Headless render of a fixture page diffs key computed styles between Sass path and CSS-var path to keep the two paths' documented fidelity gap accurate.

## Doc capability (Tier 3, later)

Candidate for `transtyle doc`: docs build is Hugo at pinned tags, license CC BY 3.0 (attribution required — noted in generated output). Ships only with a named maintainer per [doc-generation.md](../doc-generation.md).
