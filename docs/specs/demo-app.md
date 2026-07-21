# Demo projects — one fake app, N real projects

Status: **v1, implemented**, across all four in-repo examples (Acme, Cathode, GOV.UK, Carbon). Grew out of backlog item [B2](../backlog.md) ("theme kit"); the `create-transtyle` template packaging stays in the backlog until npm publication. (v0 was a set of static CDN pages; superseded 2026-07-20 by real npm projects — the static approach couldn't consume `dist/` artifacts natively and faked the frameworks' components.)

## Purpose

Each example design system (Acme, Cathode, future ones) ships runnable demo projects under `examples/<example>/demo/<target>/` — **one real npm project per target technology**, using that target's genuine toolchain, configuration, and components from its own docs, themed **only by the transtyle-built `dist/` artifacts**. Three jobs:

1. **Eyeball cross-target fidelity.** The same fake page rendered by real Bootstrap and real shadcn/ui, from the same token source.
2. **Eyeball cross-DS robustness.** The same projects under Acme (corporate blue) and Cathode (CRT terminal) prove themes are data, not code.
3. **Ground-truth the exporters.** Every project exercises the artifact exactly the way `dist/<target>/usage.md` prescribes — if the wiring in a demo needs anything more, the usage doc (or the exporter) is wrong.

## The projects

| Project | Toolchain | What it renders | Theme consumption (from `../../dist/`) |
|---|---|---|---|
| `demo/bootstrap` | Vite + `bootstrap` (npm) + `sass` | **Nimbus Console** (see below) with Bootstrap's own components | Sass path: `_variables.transtyle.scss` before Bootstrap, `_maps.transtyle.scss` after its variables — every component compiled from the theme |
| `demo/shadcn` | Vite + React + Tailwind v4 + shadcn/ui registry components (vendored, incl. Radix) | The **same Nimbus Console** | `globals.transtyle.css` imported after `tailwindcss` — the file `shadcn init` would have scaffolded |
| `demo/daisyui` | Vite + Tailwind v4 + `daisyui` plugin | The **same Nimbus Console** | `daisyui.transtyle.css` imported into the Tailwind pipeline — its `@plugin "daisyui/theme"` blocks register both mode themes natively |
| `demo/echarts` | Vite + `echarts` (npm) | **Nimbus Analytics** — a different fake page: the dashboard behind the console (bar/line/donut/mixed charts). The page shell's colors come from the theme JSON itself | per-mode `theme.*.json` imported and `registerTheme`d; re-`init` on mode switch |
| `demo/storybook` | Storybook (`html-vite`), nothing else | The simplest possible Storybook — **the demo is Storybook's own chrome** (sidebar, toolbar, controls, fonts), not the stories. One deliberate text story ("Welcome") explains what to look at; a single text arg gives the Controls panel something themed to show | `.storybook/manager.ts` imports `manager.transtyle.ts` (themed chrome, DS-native mode); `.storybook/preview.ts` re-exports `preview.transtyle.ts` (Scheme toolbar, mode decorator whose canvas wears the DS background via the sibling shadcn variables, DS backgrounds) |
| `demo/css-variables` | Vite, framework-free | The **same Nimbus Console**, plain HTML/CSS — the reference projection every other exporter's output is some mapping of | `variables.transtyle.css` imported directly; every value is a custom property, nothing else |
| `demo/radix` | Vite + React + `@radix-ui/themes` | The **same Nimbus Console** with real Radix Themes components | `radix-colors.transtyle.css` overrides one existing Radix preset's scale (`--violet-*` etc. → `--primary-*`), passed to `<Theme accentColor="...">` |
| `demo/primeng` | **Angular** (standalone components, `@angular/build:application`) — the first non-Vite/React profile, see below | The **same Nimbus Console** with real PrimeNG components | `preset.transtyle.ts` (a `definePreset(Aura, overrides)` module) passed to `providePrimeNG({ theme: { preset } })` in `app.config.ts` |

**Nimbus Console** — the shared fake page (deliberately *not* named after any example DS): §1 header (brand, 3 nav links one active, primary action) · §2 buttons in every role the target names + badges (+ alert where idiomatic) · §3 form (input + help, invalid input + error, select, checkbox, radio pair, switch, submit/cancel) · §4 card (title, muted subtitle, body with link + `code`, action footer) · §5 table (4 rows, status badges across roles) · §6 modal (real trigger, confirm/cancel, the target's own modal mechanism). A thin **demo chrome bar** above the app (not part of the fake page) carries the DS label, a one-line status note, and the mode toggle wired to the target's own mechanism (`data-bs-theme` / `.dark` / `data-theme`).

## Implementation rules

- **Theme comes only from compiled output.** Projects import artifacts from the example's `dist/` exactly as that target's generated `usage.md` prescribes. Never hand-copy values. A `predev`/`prebuild` script runs `transtyle build --cwd ../..` so `dist/` always exists and is fresh.
- **One file of DS-specifics.** Within a target, the project is file-identical across examples except `src/ds.config.{js,ts}` (DS label, default mode, theme/font names) and `package.json` (workspace name, port). If an example needs any other difference, that's a finding, not a patch.
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
