# Demo app — one fake app, N targets

Status: **v0, implemented** for the in-repo examples ([examples/demo-app/](../../examples/demo-app/)). Grew out of backlog item [B2](../backlog.md) ("theme kit"); the `create-transtyle` template packaging of it stays in the backlog until npm publication.

## Purpose

A deliberately boring product page — "Nimbus Console", a small admin dashboard (deliberately *not* named after any example DS) — specified once and implemented once per supported target technology, always rendering from a design system's *compiled transtyle output*. Three jobs:

1. **Eyeball cross-target fidelity.** The same app in Bootstrap, daisyUI, and shadcn, themed from the same token source, viewed side by side. Divergence you can see is a bug you can file.
2. **Eyeball cross-DS robustness.** The same app rendered under different design systems (Acme's corporate blue, Cathode's CRT terminal) proves themes are data, not code.
3. **Seed the future ground-truth fixture.** One app spec, N implementations is exactly the shape Phase 2's `transtyle preview` needs for component samples; this spec is its first draft.

## The app: required sections

Every target implementation renders the **same sections in the same order**, using that target's *idiomatic* markup and component classes (no lowest-common-denominator HTML — the point is how the real framework renders):

| # | Section | Must contain |
|---|---------|--------------|
| 1 | **Header** | App name, 3 nav links (one active), a primary action button. (DS switcher and mode toggle live in the demo chrome bar above the app, so the fake app stays pure) |
| 2 | **Buttons** | One button per role the target names (primary, secondary, success/info/warning/danger or destructive, neutral/ghost/outline variants where idiomatic), plus one disabled state |
| 3 | **Form** | Text input (with label + help text), select, checkbox, radio pair, switch/toggle where the target has one, one control in an invalid/error state, submit + cancel buttons |
| 4 | **Card** | Title, muted description, body text with a link and inline `code`, footer with actions |
| 5 | **Table** | ≥4 rows, header row, one status badge per row exercising different roles, hover/striped styling where idiomatic |
| 6 | **Modal** | Opened by a real button, title + body + confirm/cancel, uses the target's own modal mechanism |
| 7 | **Chart** | The same line+bar combo chart via Apache ECharts, initialized with the DS's compiled ECharts theme for the current mode |

## Implementation rules

- **Theme comes only from compiled output.** Pages link the artifacts in `examples/<ds>/dist/` (or a mechanical, committed transform of them when the artifact isn't directly browser-loadable — see daisyUI below). Never hand-copy values into demo styles.
- **No per-DS branches in markup or CSS.** Switching `?ds=` may only swap theme assets. If a DS needs a markup change, that's a finding, not a patch.
- **Static, no build step.** Plain HTML/CSS/JS, openable from disk; framework runtimes come from pinned CDN URLs (the only network dependency).
- **Modes.** Each page has a light/dark toggle wired to the target's own mode mechanism (`data-bs-theme`, daisyUI `data-theme`, shadcn `.dark`) and re-inits the chart with the matching ECharts theme. `?mode=` presets it; a DS may declare its native mode as default (Cathode → dark).
- **Status honesty (policy B1).** A page for a specced-but-unimplemented exporter must say so on the page and label what it loads (e.g. Bootstrap loads the engine-exact acceptance fixture, CSS-variable path — component-baked literals visibly *don't* retheme; that's the documented F13 lesson, not a demo bug).

### Per-target notes

- **Bootstrap** (5.3, CDN CSS+JS): loads `expected/bootstrap/bootstrap-theme.css` after Bootstrap. Acme only until the exporter ships; the fixture's CSS-variable path only rethemes the token tier.
- **daisyUI** (5, CDN CSS): the exporter emits `@plugin "daisyui/theme"` blocks, which are Tailwind-build input, not browser CSS. `build-themes.mjs` mechanically converts each block to a `[data-theme="<name>"]` ruleset (committed under `examples/demo-app/themes/`, regenerate after `transtyle build daisyui`).
- **shadcn** (no runtime): links `dist/shadcn/globals.transtyle.css` directly; components are rendered by `shared/shadcn-demo.css`, hand-written CSS following shadcn's component recipes against the token contract (`--background`, `--primary`, `--radius`…). This demonstrates the *theme contract*, not Radix behavior — labeled as such on the page.
- **ECharts**: every page's §7 loads the self-registering `dist/echarts/theme.<ds>-<mode>.js` and inits with that theme name.

## Adding a target or a DS

A new **target** = one new `<target>.html` implementing the seven sections idiomatically + an entry in `shared/demo.js`'s target list. A new **DS** = one entry in `shared/demo.js`'s DS map pointing at its compiled artifacts (plus a themes/ conversion if it ships daisyUI). Nothing else may need touching.
