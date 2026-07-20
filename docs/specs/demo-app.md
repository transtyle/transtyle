# Demo app — one fake app, N targets

Status: **v0, implemented** for the in-repo examples — each example ships its own self-contained copy at [examples/acme/demo/](../../examples/acme/demo/) and [examples/cathode/demo/](../../examples/cathode/demo/), themed by that example's compiled output. Grew out of backlog item [B2](../backlog.md) ("theme kit"); the `create-transtyle` template packaging of it stays in the backlog until npm publication.

## Purpose

A deliberately boring product page — "Nimbus Console", a small admin dashboard (deliberately *not* named after any example DS) — specified once and implemented once per supported target technology, always rendering from a design system's *compiled transtyle output*. Three jobs:

1. **Eyeball cross-target fidelity.** The same app in Bootstrap, daisyUI, and shadcn, themed from the same token source, viewed side by side. Divergence you can see is a bug you can file.
2. **Eyeball cross-DS robustness.** The same app rendered under different design systems (Acme's corporate blue, Cathode's CRT terminal) proves themes are data, not code.
3. **Seed the future ground-truth fixture.** One app spec, N implementations is exactly the shape Phase 2's `transtyle preview` needs for component samples; this spec is its first draft.

## The app: required sections

Every target implementation renders the **same sections in the same order**, using that target's *idiomatic* markup and component classes (no lowest-common-denominator HTML — the point is how the real framework renders):

| # | Section | Must contain |
|---|---------|--------------|
| 1 | **Header** | App name, 3 nav links (one active), a primary action button. (Mode toggle and target links live in the demo chrome bar above the app, so the fake app stays pure; each example's hub cross-links the other example for DS-vs-DS comparison) |
| 2 | **Buttons** | One button per role the target names (primary, secondary, success/info/warning/danger or destructive, neutral/ghost/outline variants where idiomatic), plus one disabled state |
| 3 | **Form** | Text input (with label + help text), select, checkbox, radio pair, switch/toggle where the target has one, one control in an invalid/error state, submit + cancel buttons |
| 4 | **Card** | Title, muted description, body text with a link and inline `code`, footer with actions |
| 5 | **Table** | ≥4 rows, header row, one status badge per row exercising different roles, hover/striped styling where idiomatic |
| 6 | **Modal** | Opened by a real button, title + body + confirm/cancel, uses the target's own modal mechanism |
| 7 | **Chart** | The same line+bar combo chart via Apache ECharts, initialized with the DS's compiled ECharts theme for the current mode |

## Implementation rules

- **One demo per example, all DS-specifics in one file.** Each example's `demo/` is self-contained (copyable with the example). Every file in it is byte-identical across examples — pages, `assets/demo.{css,js}`, `assets/shadcn-demo.css` — except `assets/ds.config.js` (theme-asset paths, ECharts/daisyUI theme names, fonts, default mode, per-target status notes) and which `<target>.html` files exist (Cathode has no bootstrap page: no compiled artifact to render). If a DS needs a *markup* change, that's a finding, not a patch.
- **Theme comes only from compiled output.** Pages link the artifacts in the example's own `dist/` (or a mechanical, committed transform of them when the artifact isn't directly browser-loadable — see daisyUI below). Never hand-copy values into demo styles.
- **Static, no build step.** Plain HTML/CSS/JS, openable from disk; framework runtimes come from pinned CDN URLs (the only network dependency).
- **Modes.** Each page has a light/dark toggle wired to the target's own mode mechanism (`data-bs-theme`, daisyUI `data-theme`, shadcn `.dark`) and re-inits the chart with the matching ECharts theme. `?mode=` presets it; a DS may declare its native mode as default in `ds.config.js` (Cathode → dark).
- **Status honesty (policy B1).** A page for a specced-but-unimplemented exporter must say so on the page and label what it loads (e.g. Bootstrap loads the engine-exact acceptance fixture, CSS-variable path — component-baked literals visibly *don't* retheme; that's the documented F13 lesson, not a demo bug).

### Per-target notes

- **Bootstrap** (5.3, CDN CSS+JS): loads `expected/bootstrap/bootstrap-theme.css` after Bootstrap. Acme only until the exporter ships; the fixture's CSS-variable path only rethemes the token tier.
- **daisyUI** (5, CDN CSS): the exporter emits `@plugin "daisyui/theme"` blocks, which are Tailwind-build input, not browser CSS. [examples/build-demo-themes.mjs](../../examples/build-demo-themes.mjs) mechanically converts each block to a `[data-theme="<name>"]` ruleset (committed as `demo/themes/daisyui.css`; it also extracts shadcn's `@theme` font/radius lines to `demo/themes/extras.css` — regenerate after `transtyle build`).
- **shadcn** (no runtime): links `dist/shadcn/globals.transtyle.css` directly; components are rendered by `assets/shadcn-demo.css`, hand-written CSS following shadcn's component recipes against the token contract (`--background`, `--primary`, `--radius`…). This demonstrates the *theme contract*, not Radix behavior — labeled as such on the page.
- **ECharts**: every page's §7 loads the self-registering `dist/echarts/theme.<name>-<mode>.js` and inits with that theme name.

## Adding a target or an example

A new **target** = one new `<target>.html` per example implementing the seven sections idiomatically + entries in each `ds.config.js` (`targets`, `themes`, notes). A new **example** = copy an existing `demo/` (pages + assets), rewrite only `assets/ds.config.js`, drop the `<target>.html` files it has no artifacts for, and run the converter. Nothing else may need touching — any other required edit is a spec violation to fix.
