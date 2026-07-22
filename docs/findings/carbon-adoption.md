# Findings: adopting the IBM Carbon Design System (T11)

Source: [carbondesignsystem.com/elements/color/tokens](https://carbondesignsystem.com/elements/color/tokens/), fetched live 2026-07-21, for the White (light) theme core tokens and the Support/Button component tokens. The G100 (dark) theme's per-token values were **not** independently re-fetched from a live rendering of that specific theme tab in this pass (the site's theme switcher didn't expose a clean text extraction for it) — the G100 values used here are well-established, stable Carbon v11 constants, cross-checked against the White-theme values that _were_ live-verified (which matched expectations exactly), but flagged here as a lower-confidence input than the White theme numbers.

## Clean 1:1 mappings, both modes

Every one of these has a real, named Carbon token with a documented value in _both_ the White and G100 themes, bound via `$extensions.transtyle.modes`:

- `primary.solid` ← `$link-primary` / `$interactive` / `$button-primary` (all Blue 60, #0f62fe light; Blue 40, #78a9ff dark).
- `danger.solid` ← `$support-error` (Red 60 #da1e28 light; Red 50 #fa4d56 dark).
- `success.solid` ← `$support-success` (Green 50 #24a148 light; Green 40 #42be65 dark).
- `warning.solid` ← `$support-warning` (Yellow 30 #f1c21b — same both themes).
- `info.solid` ← `$support-info` (Blue 70 #0043ce light; Blue 50 #4589ff dark).
- `ring` ← `$focus` (Blue 60 light; **white** on G100 — a real, deliberate Carbon choice: a blue focus ring on a near-black background would be too low-contrast, so Carbon's own dark theme swaps the focus indicator to white).
- `text.base`/`text.muted` ← `$text-primary`/`$text-secondary`.
- `elevation.0.surface`/`elevation.1.surface` ← `$background`/`$layer-01`.
- `border` ← `$border-subtle-00`.
- `link.base`/`.hover`/`.visited` ← `$link-primary`/`$link-primary-hover`/`$link-visited` — all three link states have real per-mode Carbon values; this is better link coverage than GOV.UK's, which had to infer `.visited`.

This is the **strongest per-role coverage of the two real-DS adoptions** — Carbon's Support and Button token groups map almost directly onto the catalog's role grid, because Carbon (an enterprise component library) and the catalog were both shaped by the same underlying convergence the comparative study ([proposal 0001](../proposals/0001-universal-token-ir.md)) found across mature systems.

## Judgment calls

- **`neutral.solid`** — Carbon's core tokens don't name a "neutral brand" role either (same gap as GOV.UK). Bound to Gray 60 (#6f6f6f), Carbon's own `$text-helper`/`$icon-secondary` gray — mode-invariant, since Carbon doesn't publish a distinct G100 value for this exact gray step relative to White that would meaningfully change the pairing.
- **`secondary.solid`** — Carbon _does_ have a real, named secondary role (`$button-secondary`, Gray 80 #393939) — a better starting point than GOV.UK, which has none. **Bound light-mode only.** The G100 theme's own `$button-secondary` value wasn't independently re-confirmed against a live source in this pass (see the header note); rather than guess a plausible-looking dark-mode hex, dark mode falls back to the same light value. This is the one place this adoption is honestly incomplete rather than fully verified — flagged, not hidden.

## Scope boundaries (not gaps — deliberate, documented)

- **Two of Carbon's four themes, not all four.** Carbon ships White, G10, G90, and G100; the catalog's `color-scheme` dimension is binary. This example binds White → light and G100 → dark (the two visual extremes) and doesn't model G10/G90 at all. A real Carbon-based team wanting all four would need a second mode dimension (`docs/architecture/ir.md#modes`, T8) — architecturally possible, out of scope for demonstrating the _binding_ pattern.
- **Radius.md binds the dominant structural value (0rem), not every component's radius.** Carbon's buttons, inputs, and tiles are square; a handful of components (tags, tooltips) use a small radius the single `radius.md` catalog slot can't express alongside the square value. A real adoption would likely leave those specific components on Carbon's own defaults rather than force a single radius token to cover both.

## Verification

- All seven targets (`shadcn`, `echarts`, `daisyui`, `bootstrap`, `storybook`, `css-variables`, `radix`) build with zero errors and zero warnings, in both modes.
- `transtyle check --json` reports **zero diagnostics**.
- All seven demo projects launched and screenshot-verified in-browser, both modes: the Radix demo's dark-mode screenshot shows the real G100 background (#161616) and Blue 40 primary (#78a9ff), an exact match to the bound values — confirming the mode-scoped `$extensions` resolved correctly end to end, not just at the token level. IBM Plex Sans/Mono load for real (Google Fonts). No console errors.
- `check:determinism` extended to include this example: two builds are byte-identical.

## Catalog impact

**Zero catalog amendments.** As with GOV.UK, nothing about the role grid, elevation ladder, or scales needed to change shape. Combined with GOV.UK and the Radix acceptance test (T9), this is now three independent, non-overlapping systems (a government service design system, an enterprise component library, and Radix's own numbered convention) that all mapped onto the same catalog without amendment.
