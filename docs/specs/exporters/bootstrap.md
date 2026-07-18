# Exporter spec: Bootstrap

**Why it's a reference exporter:** hardest constraint set of the four — a Sass-compiled theming system with a partial CSS-variable layer bolted on in 5.2/5.3, an opinionated color model (`$theme-colors` + generated `-bg-subtle`/`-border-subtle`/`-text-emphasis` derivations), and its own dark-mode mechanism (`data-bs-theme`). If the IR survives Bootstrap, most targets are easy.

## Compatibility

`"targets": { "bootstrap": [">=5.3 <6"] }` at launch (5.3 is where CSS-var theming and color modes stabilized). A `>=5.2 <5.3` profile may follow if demanded; Bootstrap 6 gets a new profile on release. Verify current Bootstrap state against its changelog before implementation.

## Emitted artifacts

Two consumption paths, because the Bootstrap community is split between Sass builds and CDN + overrides:

| File | Purpose |
|---|---|
| `_variables.transtyle.scss` | Sass variable overrides (`$primary`, `$font-family-sans-serif`, `$border-radius`, spacer scale…) to import **before** Bootstrap — the idiomatic customization path; users keep Bootstrap's own build pipeline |
| `_maps.transtyle.scss` | `$theme-colors` map merge + subtle/emphasis map overrides where our derived values should replace Bootstrap's own derivations |
| `bootstrap-theme.css` | Pure CSS-variable override layer (`--bs-primary`, `--bs-body-bg`, `--bs-border-radius`, + `[data-bs-theme=dark]` block) for no-Sass users; documented as the lower-fidelity path (Sass-compiled derivations like button hover states can't all be reached from CSS vars) |
| `usage.md` | Generated per-build: exact import order, which path to choose, coverage summary |

## Mapping strategy (highlights)

- Semantic color roles → `$primary…$danger` and the `$theme-colors` map: `native`.
- Role `subtle`/`contrast` values → `-bg-subtle`/`-text-emphasis` maps: `native`, and *we* override Bootstrap's sRGB `tint-color()`/`shade-color()` derivations with our OKLCH-derived values (ours are perceptually consistent; classified `derived` when the source token was itself derived).
- `color-scheme` mode → `data-bs-theme="dark"` maps + CSS-var block: `native`. Other mode dimensions (density): `dropped` with reason — Bootstrap has no density concept.
- Typography roles → `$font-family-*`, `$font-size-base` + `$h*-font-size` from our type scale: `native`; `rem` conversion via config base: `approximated` if the base differs from Bootstrap's assumption.
- Spacing scale → `$spacer` + `$spacers` map: `native` when our scale is linear; `approximated` when a non-linear scale is flattened onto Bootstrap's map.
- Radius/shadows/borders → `$border-radius*`, `$box-shadow*`: `native`. Motion: Bootstrap themes almost none of it → mostly `dropped`.
- `unsupported` examples we must report honestly: Bootstrap's grid/breakpoint variables (no IR concept yet — breakpoints are a known catalog-candidate), component-tier `$btn-*` variables (reserved for v2).

## Ground-truth testing

CI compiles real Bootstrap (each supported minor) with our emitted Sass; asserts compilation succeeds and spot-checks resolved CSS custom-property values in the built stylesheet. Headless render of a fixture page diffs key computed styles between Sass path and CSS-var path to keep the two paths' documented fidelity gap accurate.

## Doc capability (Tier 3, later)

Candidate for `transtyle doc`: docs build is Hugo at pinned tags, license CC BY 3.0 (attribution required — noted in generated output). Ships only with a named maintainer per [doc-generation.md](../doc-generation.md).
