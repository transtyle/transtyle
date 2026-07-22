# Findings: adopting the GOV.UK Design System (T11)

Source: [design-system.service.gov.uk/styles/colour](https://design-system.service.gov.uk/styles/colour/) and [.../styles/type-scale](https://design-system.service.gov.uk/styles/type-scale/), both fetched live 2026-07-21. Values transcribed verbatim into `examples/govuk/tokens/option.tokens.json`.

## Clean 1:1 mappings

- `primary.solid` ← `govuk-functional-colour("brand")` (#1d70b8). Unambiguous — GOV.UK has exactly one brand color.
- `danger.solid` ← `govuk-functional-colour("error")` (#ca3535).
- `success.solid` ← `govuk-functional-colour("success")` (#0f7a52).
- `ring` ← `govuk-functional-colour("focus")` (#ffdd00). **The best mapping found in this pass** — GOV.UK's iconic yellow keyboard-focus outline is _exactly_ what the catalog's `ring` slot exists for, no interpretation needed.
- `text.base`/`text.muted` ← `text`/`secondary-text` functional colours.
- `border` ← `border` functional colour.
- `elevation.0.surface`/`elevation.1.surface` ← `body-background`/`template-background`.
- `link.base`/`link.hover` ← `link`/`link-hover` functional colours.
- `radius.md` = `0rem` — real, not fictional: GOV.UK Design System components render with no border-radius by design.

## Judgment calls (no direct GOV.UK equivalent)

- **`neutral.solid`** — GOV.UK's functional-colour set has no "neutral brand" concept. Bound to the web palette's Black tint-50 (#858686), the closest authored gray anchor. A different reasonable choice existed (Black tint-25, #484949, closer to `secondary-text`) — tint-50 was chosen to sit visually between the text tints and the border tint, matching how `neutral` behaves in Acme/Cathode's own binding.
- **`link.visited`** — not part of GOV.UK's functional-colour set at all. Bound to the web palette's purple (#54319f), matching the classic browser/GOV.UK-frontend convention for visited links. This is a real historical GOV.UK color choice, just not currently exposed as a named functional colour.
- **`secondary.solid`, `accent.solid`, `warning.solid`, `info.solid`** — **left unbound, deliberately.** GOV.UK's functional-colour set doesn't name any of these four roles. Rather than invent a binding for a role the source system doesn't distinguish, they're left to the standard rule pack: `secondary` desaturates `primary`, `accent` aliases `primary`, `warning`/`info` hue-anchor to 85°/230°. Verified via `transtyle explain`: `warning.solid` derives to `oklch(0.76 0.14 85)` (#daa932) — a defensible amber, coherent with the brand, not GOV.UK's own choice because GOV.UK hasn't made one at this granularity.

## Scope boundaries (not gaps — deliberate, documented)

- **No dark mode.** `modes.color-scheme` declares only `"light"`. GOV.UK's public design system doesn't publish a dark theme; declaring one would mean inventing colors GOV.UK never specified. A single-mode config is fully legal (`docs/architecture/ir.md#modes`) — this is a positive finding, not a limitation: the engine, all seven exporters, and the demo projects all handle a single-dimension, single-value mode config with zero special-casing.
- **Type scale not bound.** GOV.UK's own type scale (16/19/24/27/36/48/80px, responsive) doesn't map cleanly onto the catalog's fixed `type.size.*` steps without either distorting GOV.UK's scale or extending the catalog's. Left as a catalog default per the adoption playbook's "don't translate everything on day one" guidance — a real team adopting GOV.UK for production would bind this properly; it's out of scope for demonstrating the binding-layer _pattern_, which is what T11 tests.
- **Font fallback, not the real GOV.UK typeface.** GDS Transport is licensed to crown services only and isn't publicly hosted. `option.font.transport` names GOV.UK's own real fallback stack (`GDS Transport, arial, sans-serif`); the demo projects render in `arial`, exactly as GOV.UK's own CSS would for any non-crown-service consumer. A licensing constraint, not a compiler one.

## Verification

- All seven targets (`shadcn`, `echarts`, `daisyui`, `bootstrap`, `storybook`, `css-variables`, `radix`) build with zero errors and zero warnings.
- `transtyle check --json` reports **zero diagnostics** — no contrast failures against WCAG 2.1 AA, no dangling aliases, no structural DTCG issues.
- All seven demo projects launched and screenshot-verified in-browser: correct brand colors, correct flat (0-radius) aesthetic, no console errors. The mode toggle button is present but inert (no `.dark`/`[data-color-scheme="dark"]` block exists to switch to) — confirmed as the expected, documented behavior of a single-mode config, not a bug.
- `check:determinism` extended to include this example: two builds are byte-identical.

## Catalog impact

**Zero catalog amendments.** No grid cell, ladder rung, or scale needed to change shape to accommodate GOV.UK. Per ADR-0010, this doesn't reset any "clean attempt" counter because the catalog is still pre-freeze (freeze re-arms at first npm publication) — but it is additional, real-world evidence (alongside the Radix acceptance test, T9) that the role grid generalizes past the systems it was designed against.
