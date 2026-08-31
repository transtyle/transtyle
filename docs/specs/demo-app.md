# Demo projects — one fake app, N real projects

Status: **v1, implemented**, across all four in-repo examples (Acme, Cathode, GOV.UK, Carbon). Grew out of backlog item [B2](../backlog.md) ("theme kit"); the `create-transtyle` template packaging stays in the backlog until npm publication. (v0 was a set of static CDN pages; superseded 2026-07-20 by real npm projects — the static approach couldn't consume `dist/` artifacts natively and faked the frameworks' components.)

## Purpose

Each example design system (Acme, Cathode, future ones) ships runnable demo projects under `examples/<example>/demo/<target>/` — **one real npm project per target technology**, using that target's genuine toolchain, configuration, and components from its own docs, themed **only by the transtyle-built `dist/` artifacts**. Three jobs:

1. **Eyeball cross-target fidelity.** The same fake page rendered by real Bootstrap and real shadcn/ui, from the same token source.
2. **Eyeball cross-DS robustness.** The same projects under Acme (corporate blue) and Cathode (CRT terminal) prove themes are data, not code.
3. **Ground-truth the exporters.** Every project exercises the artifact exactly the way `dist/<target>/usage.md` prescribes — if the wiring in a demo needs anything more, the usage doc (or the exporter) is wrong.

## The projects

| Project              | Toolchain                                                                                                       | What it renders                                                                                                                                                                                                                                                    | Theme consumption (from `../../dist/`)                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `demo/bootstrap`     | Vite + `bootstrap` (npm) + `sass`                                                                               | **Nimbus Console** (see below) with Bootstrap's own components                                                                                                                                                                                                     | Sass path: `_variables.transtyle.scss` before Bootstrap, `_maps.transtyle.scss` after its variables — every component compiled from the theme                                                                                                                            |
| `demo/shadcn`        | Vite + React + Tailwind v4 + shadcn/ui registry components (vendored, incl. Radix)                              | The **same Nimbus Console**                                                                                                                                                                                                                                        | `globals.transtyle.css` imported after `tailwindcss` — the file `shadcn init` would have scaffolded                                                                                                                                                                      |
| `demo/daisyui`       | Vite + Tailwind v4 + `daisyui` plugin                                                                           | The **same Nimbus Console**                                                                                                                                                                                                                                        | `daisyui.transtyle.css` imported into the Tailwind pipeline — its `@plugin "daisyui/theme"` blocks register both mode themes natively                                                                                                                                    |
| `demo/echarts`       | Vite + `echarts` (npm)                                                                                          | **Nimbus Analytics** — a different fake page: the dashboard behind the console (bar/line/donut/mixed charts). The page shell's colors come from the theme JSON itself                                                                                              | per-mode `theme.*.json` imported and `registerTheme`d; re-`init` on mode switch                                                                                                                                                                                          |
| `demo/storybook`     | Storybook (`html-vite`), nothing else                                                                           | The simplest possible Storybook — **the demo is Storybook's own chrome** (sidebar, toolbar, controls, fonts), not the stories. One deliberate text story ("Welcome") explains what to look at; a single text arg gives the Controls panel something themed to show | `.storybook/manager.ts` imports `manager.transtyle.ts` (themed chrome, DS-native mode); `.storybook/preview.ts` re-exports `preview.transtyle.ts` (Scheme toolbar, mode decorator whose canvas wears the DS background via the sibling shadcn variables, DS backgrounds) |
| `demo/css-variables` | Vite, framework-free                                                                                            | The **same Nimbus Console**, plain HTML/CSS — the reference projection every other exporter's output is some mapping of                                                                                                                                            | `variables.transtyle.css` imported directly; every value is a custom property, nothing else                                                                                                                                                                              |
| `demo/radix`         | Vite + React + `@radix-ui/themes`                                                                               | The **same Nimbus Console** with real Radix Themes components                                                                                                                                                                                                      | `radix-colors.transtyle.css` overrides one existing Radix preset's scale (`--violet-*` etc. → `--primary-*`), passed to `<Theme accentColor="...">`                                                                                                                      |
| `demo/primeng`       | **Angular** (standalone components, `@angular/build:application`) — the first non-Vite/React profile, see below | The **same Nimbus Console** with real PrimeNG components                                                                                                                                                                                                           | `preset.transtyle.ts` (a `definePreset(Aura, overrides)` module) passed to `providePrimeNG({ theme: { preset } })` in `app.config.ts`                                                                                                                                    |

**Nimbus Console** — the shared fake page (deliberately _not_ named after any example DS): §1 header (brand, 3 nav links one active, primary action) · §2 buttons in every role the target names + badges (+ alert where idiomatic) · §3 form (input + help, invalid input + error, select, checkbox, radio pair, switch, submit/cancel) · §4 card (title, muted subtitle, body with link + `code`, action footer) · §5 table (4 rows, status badges across roles) · §6 modal (real trigger, confirm/cancel, the target's own modal mechanism). A thin **demo chrome bar** above the app (not part of the fake page) carries the DS label, a one-line status note, and the mode toggle wired to the target's own mechanism (`data-bs-theme` / `.dark` / `data-theme`).

## Implementation rules

- **Theme comes only from compiled output.** Projects import artifacts from the example's `dist/` exactly as that target's generated `usage.md` prescribes. Never hand-copy values. A `predev`/`prebuild` script runs `transtyle build --cwd ../..` so `dist/` always exists and is fresh.
- **One file of DS-specifics.** Within a target, the project is file-identical across examples except `src/ds.config.{js,ts}` (DS label, default mode, theme/font names) and `package.json` (workspace name, port). If an example needs any other difference, that's a finding, not a patch.

  **Enforced since 2026-07-23 by `check:demo-parity`** (in `check:all`): every demo source file must be byte-identical across all four examples, and a file present in one example's demo but not another's is drift too. This rule was prose-only until a tooltip added to Acme's Bootstrap and PrimeNG demos silently diverged three files — the invariant is what makes the demos a _comparison_ rather than four unrelated pages, so it now fails the build instead of relying on discipline.

  `package.json` is covered too, canonicalized rather than compared raw: `name` must equal `<example>-demo-<target>` exactly, the dev/preview port is masked, and everything left — dependencies, devDependencies, the rest of `scripts` — must be identical. That is the field that most matters to get right: without it one demo could pin a different framework version than its siblings and the cross-example comparison would quietly stop being like-for-like.

  The checker carries one exception the prose above had missed, and it is a genuine finding rather than a patch: **`demo/radix/src/theme-override.css`**. Radix's `<Theme accentColor>` prop only accepts Radix's own preset names, so each example aliases a different one onto our primary ramp (violet for Acme, green for Cathode, blue for GOV.UK, indigo for Carbon). That is a per-design-system mapping the target forces, not demo drift.

- **Real components only.** Markup/components come from the target's own docs (Bootstrap components, shadcn registry sources, daisyUI classes). No hand-rolled imitations.
- **npm-launchable.** Every project is a workspace: `npm run dev -w <example>-demo-<target>`. Ports follow `<example-block>0<target-slot>`: Acme 4101–4107 (bootstrap/daisyui/shadcn/echarts/css-variables/radix/primeng) + 6101 (Storybook); Cathode 4201–4207 + 6201; GOV.UK 4301–4307 + 6301; Carbon 4401–4407 + 6401 (see `.claude/launch.json` for the exact per-target assignment).
- **Mode polarity.** Cathode's projects default to dark (the terminal is native); the toggle always drives the target's own mechanism.

## The Angular profile (`demo/primeng`, the first non-Vite/React project)

Every prior project shares a Vite-based toolchain; PrimeNG is Angular-only, so `demo/primeng` is a real standalone Angular application (`@angular/build:application`, the modern esbuild-based builder — no `zone.js`, matching current Angular's zoneless default) instead of a Vite project. Structurally it's the same "one file of DS-specifics" rule, just with Angular's file layout:

- `src/ds.config.ts` — the one per-example file (label, default mode, `fontsHref`), same role as every other project's `ds.config`.
- `src/app/app.config.ts` — `providePrimeNG({ theme: { preset, options: { darkModeSelector: '.dark', cssLayer: false } } })`, importing `preset.transtyle.ts` from `../../../../dist/primeng/` (one `../` deeper than a Vite project's `src/`, since Angular's convention nests the root component under `src/app/`). Also needs `provideAnimationsAsync()` (PrimeNG's ripple/transition effects depend on `@angular/animations`) and `@angular/cdk` as an installed peer dependency.
- `src/app/app.ts` + `src/app/app.html` — the same Nimbus Console content, in Angular template syntax, using real `primeng/*` standalone components (`Button`, `Tag`, `Message`, `InputText`, `Select`, `Checkbox`, `RadioButton`, `ToggleSwitch`, `TableModule`, `Dialog`, `Card`).
- `angular.json` — one `application`/`dev-server` builder pair per project, mirroring the CLI's own scaffold (`ng new --standalone`) rather than a hand-invented config.
- Mode toggle: identical mechanism to every other demo — `.dark` class on `<html>`, driven by the chrome bar's toggle button.

**A real, useful side effect of this toolchain choice:** Angular's build type-checks the imported preset against PrimeNG's own `DesignTokens` TypeScript types. This caught genuine structural bugs in the exporter during development — a flat object where PrimeNG's type requires `{ light, dark }`, a component-specific type narrower than the shared semantic group — that a Vite project's untyped build would have shipped silently. No other demo project gets this level of ground-truthing for free.

## Adding a target or an example

A new **target** = one new project directory per example (same fake page, that target's idiom) once its exporter ships. A new **example** = copy an existing example's `demo/`, rewrite the `ds.config` files and package names/ports, run `transtyle build`. Anything else that needs touching is a spec violation to fix.

## The hosted exhibit

Everything above describes the demo _projects_ — what a contributor clones and runs. Publishing the
same 32 projects as one browsable exhibit needs two things the projects deliberately do not carry,
both injected at assembly time (`scripts/lib/demo-chrome.mjs`, called from `scripts/assemble-demos.mjs`)
rather than checked in. A navigation widget for a website the demos know nothing about has no
business in a file a reader is meant to copy, and it could not be byte-identical across four examples
while naming the one it is in — which is the parity rule above. Hosting concern, hosting layer.

- **The switcher.** A pill in the bottom-left corner of every hosted demo, in a shadow root (these
  pages already ship Bootstrap, Tailwind, PrimeNG and Storybook's own CSS; `.btn` and `.panel` are
  spoken for several times over). It moves along either axis — same page, other design system; same
  design system, other target — and links onward to the gallery, the target's docs page, the demo's
  source, and the compare view.
- **The bridge.** No UI at all: a message listener that lets the compare view drive this demo's mode
  and relay its scroll position. A framed demo gets the bridge and not the switcher — inside a
  compare pane the pill is redundant and in the way.

### Keeping your place across a switch

Comparing two design systems means comparing the _same part_ of two pages, so a switcher that lands
the reader at the top makes them scroll back down every time. What the switcher carries across a jump
is a **heading**, not a scroll offset: within a target the four demos are byte-identical and their
pixel offsets are not — Cathode's monospace type and radius 0 make the same page a different height,
and Bootstrap's page is a different height again from Radix's. A slug of the heading text
(`3 · Form` → `3-form`) survives both axes, which is why the six Nimbus Console projects keep
**numbered section headings** and `check:demos` says so.

It travels in the hash (`#transtyle=<ratio>~<heading-slug>`), because that is the one part of a URL
no demo's own routing reads, and it is cleared with `history.replaceState` the moment it is spent —
a place marker left in the bar would re-fire on reload and turn up in anything the visitor copies.
The ratio rides along as the fallback for the two demos that are not that page at all (the ECharts
dashboard, the css-variables dump), where landing proportionally is at least closer than landing at
the top; Storybook gets no marker, having no section to land on and owning its own URL.

The compare view does the same thing by its own route: when one pane is swapped for another design
system, the new frame is told the shared scroll position as it announces itself, so changing a side
continues the comparison instead of restarting it.

### The compare view — `/compare/`

Demos in iframes, sharing one mode control and one scroll position. It is its own route rather than a
gallery mode because the state is worth a URL, the layout wants the viewport, and the gallery stays
one crawlable document. Entry points: the gallery hero, a per-row `⇄ compare all 4` link in the
gallery matrix, the switcher's footer in every demo, and the site footer.

Two shapes, because there are two arguments to make:

- **Two panes** (`?left=govuk.bootstrap&right=carbon.radix&mode=dark`) — any pair, on either axis,
  with a draggable splitter. This is the one that can compare across ecosystems, and the one whose
  URL is worth sending: it is the shareable form of a particular argument.
- **The whole row** (`?row=bootstrap&mode=dark`) — every design system in one ecosystem at once. The
  gallery's matrix tells the visitor to "read across a row"; this is that row, live. The columns come
  from `EXAMPLES`, so a fifth design system becomes a fifth column on the commit that adds it.

Only one shape's frames are loaded at a time — the other's are blanked to `about:blank` — so the
shape you are not looking at costs nothing.

**The row is scaled, not squeezed**, and that was decided by measuring rather than by taste. Four
equal columns on a 1440px laptop are 344px wide, and at 344px every demo overflows its own column
horizontally (106px for Acme, 127px for Cathode, whose monospace tracking is the widest), turning the
row into four cramped mobile layouts each with a scrollbar of its own. Sweeping the width upward, the
overflow disappears at **480px** and not before — but four 480px panes need ~1950px of window, which
is not a laptop. So each frame is laid out at 480px and drawn at whatever fraction of that the column
actually has (a CSS `transform: scale`, recomputed on resize). The layout in each pane is then the
real one at a size you can compare but not read, which is the right trade: reading across a row is a
question about colour, corner radius, type and density, and the two-pane shape is one click away for
anything closer. The page says the scale out loud rather than leaving it to be noticed.

**How one control drives two demos.** The compare page and the demos are same-origin, so the page
_could_ walk each frame's document itself. It does not: every target encodes the mode its own way
(`data-bs-theme`, `.dark`, `data-theme`, a re-`init`ed ECharts instance, an Angular signal), and a
parent reaching in would have to learn all eight and re-learn the ninth. The demos already agree on
something better — **every one of them puts the mode on a real button labelled with the mode it
switches _to_** (`☀ light` while dark, `☾ dark` while light) — so the bridge presses that button and
each demo does its own thing. `check:demos` proves that convention still holds in all 28 projects,
because renaming that label in one target would break the sync silently and only in the hosted build.

Three consequences worth knowing:

- **Storybook is the exception**, for the reason it is an exception everywhere else in this spec: the
  demo _is_ Storybook's chrome, and the scheme lives in a toolbar global rather than in the page. It
  takes the mode through the manager URL (`?globals=colorScheme:dark`) instead, so that pane reloads
  on a mode change, and its manager chrome stays in the design system's native mode.
- **A light-only system stays light.** Which modes an example publishes comes from compiling it
  (`website/src/demo-themes.js`), so GOV.UK's pane says it publishes no dark theme rather than being
  driven into one — a demo toggled into a mode its tokens do not define would fall through to the
  _framework's_ dark defaults and quietly stop showing compiled output.
- **Scroll is relayed as a ratio, not an offset**, because the same page is a different height in
  Bootstrap and in Radix, and matching pixels drift a screenful apart by the bottom of a long
  comparison.
