# 2026-07-20 — T9: the Radix Themes/Colors exporter (the grid's acceptance test)

Per [docs/plan/catalog-revision.md](../plan/catalog-revision.md) T9. T7 (role archetypes) was **not** required first — it's listed as "recommended," and nothing in the Radix mapping (§T9) depends on custom color roles; the eight built-in `COLOR_ROLES` already exercise every grid cell Radix's 12-step model needs.

## What shipped

- **`packages/exporter-radix/`** (new) — emits `radix-colors.transtyle.css` (`:root` light + `.dark` dark, per role: `--<role>-1..12`, `--<role>-a1..a12`, `--<role>-contrast`; `neutral` also aliased as Radix's conventional `--gray-*`) and `usage.md` (standalone usage + the `@radix-ui/themes` preset-override pattern).
- CLI/config wiring, `docs/specs/exporters/radix.md`, website page/nav/roadmap, README, `check-sync.mjs` NAMES entry — all five sync surfaces, verified clean by `node scripts/check-sync.mjs`.
- **`examples/{acme,cathode}/demo/radix/`** (new) — real `@radix-ui/themes` React apps rendering the same *Nimbus Console* fake page as the other demos (buttons, form, card, table, modal), with the compiled `primary`/`neutral` scales overriding an existing Radix preset (Acme → `violet`; Cathode → `green`, chosen by inspecting each brand's actual `primary.solid` OKLCH hue) so `<Theme accentColor="...">` renders the brand instead of Radix's stock color. Ports 4106/4206, added to `.claude/launch.json`.

## The acceptance-test result

Per the proposal's framing (docs/proposals/0001-universal-token-ir.md §7), Radix's 12-step-per-color model is cell-for-cell the role grid, numbered instead of named — making it a validation test for the grid design, not just another exporter. Result: **only steps 2 and 6 have no direct grid cell** (both filled by a fresh `ctx.mix` toward the surface, documented as `approximated` in coverage) — everything else, including the `contrast` on-solid color, maps to an existing grid cell natively. Both examples build at ~39-40% native / ~60% approximated / 0% dropped — the "approximated" majority is almost entirely the alpha ramp (a fixed 12-step opacity curve, not a colorimetric derivation of Radix's real per-color alpha) and the P3 wide-gamut pair Radix ships that the engine has no equivalent for, not gaps in the grid itself. **Shipped with zero catalog amendments** — the grid held up as a real universal projection rather than a shape reverse-engineered from shadcn/Bootstrap.

## A real (pre-existing) gap this surfaced, not fixed here

Building the demo apps and rendering `<role>.text-strong` directly (Radix step 12) for a *non-neutral* role at full size, in dark mode, for the first time across all exporters turned up out-of-sRGB-gamut values for vivid roles — confirmed with a direct test (`oklch(0.985 0.18 255)` clamps to a visibly different color) and with both example brands' `primary.text-strong`. Root cause: the F20 "contrast-anchor" rule in `derive.js` re-anchors lightness to the content-text lightness while keeping the role's *full* chroma; at very high lightness, sRGB's chroma headroom shrinks sharply, so a saturated brand hue clips. This is a pre-existing gap in the shared derivation rule, only newly exposed here — not something introduced by this exporter, and not something any prior exporter rendered in a way that made it visible.

Scope decision: fixed the *reporting* only — the Radix exporter checks `ctx.formatHex(value).clamped` for every step and marks clamped ones `approximated` with an explanatory note, so the coverage report is honest about it. Did not touch the shared F20 rule itself; that's a derivation-engine change affecting every exporter and every role, and belongs in its own reviewed change, not folded into an exporter PR. Flagged as a follow-up task (spawned via the session's task queue) rather than fixed or silently left undocumented.

## Verification performed before committing

- `npx transtyle build radix --cwd examples/acme` and `--cwd examples/cathode` — both succeed, coverage as above.
- `node scripts/check-sync.mjs` — clean across all seven exporters, both examples.
- Both demo apps launched in-browser: verified brand colors render (not Radix's stock violet/green), light/dark toggle works end-to-end (confirmed via computed styles, not just visually), and all six page sections (buttons, form, card, table, modal) render with real `@radix-ui/themes` components with no console errors.
- Direct node test of the gamut-clamp detection logic against a known-clamped OKLCH value.

## Scope not touched

T7 (role archetypes) remains open and was not a blocker here (see above). The `text-strong` gamut-gap fix is intentionally deferred as a separate follow-up.
