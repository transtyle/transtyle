# Worklog — B7: accept rgb()/hsl()/named CSS colors

**Task:** audit B7, promoted from 🟢 backlog to a real-adoption blocker by [P4](../findings/hostile-adoption.md), which hit a hard stop on Miniflux's literal `red`/`purple`.

## What now parses
`oklch()`, `#hex` (**3/4/6/8-digit**, alpha included), `rgb()`/`rgba()`, `hsl()`/`hsla()` — both modern space-separated (`rgb(255 0 0 / 50%)`) and legacy comma (`rgba(255,0,0,.5)`) forms, percentage channels, `deg`/`rad`/`grad`/`turn` hue units, the `none` keyword — plus all 148 CSS named colors and `transparent`. Everything still canonicalizes to OKLCH; alpha is now threaded through `srgbToOklch` (it was hardcoded to 1). `lab()`/`lch()`/`hwb()`/`color()` remain unparsed and are documented as such.

Named colors live in their own `packages/core/src/css-colors.js` data module to keep the engine readable. Still zero dependencies.

## Verification
- **Closed the P4 loop:** re-ran the Miniflux extraction with the workaround reverted — Miniflux's verbatim `red`/`purple` restored. Builds clean across all 8 targets; `ring` → `#ff0000`, `link.visited` → `#800080`. The playbook's "verbatim, no renaming" rule is now honorable for a real product.
- **No regression:** `check:fixtures` and `check:determinism` byte-identical; existing examples use only oklch/hex so nothing moved.
- **New `scripts/check-color.mjs`** (wired into `check:all` + CI): asserts every syntax against *reference* values (not our own snapshots), alpha from each carrier, that unsupported syntax still throws, hex round-trip fidelity, and WCAG contrast reference points (black/white = 21:1). Also chips at audit A3's "no colour-math tests".

> **Correction (same day, found while doing P2).** This worklog and my report to the maintainer originally claimed hex "round-trips losslessly, 0 delta over 4096 random samples". That was **luck, not proof**: the check used `Math.random()`, so it was both flaky and blind to a small affected population. An exhaustive 16,777,216-value sweep shows **1580 values (0.0094%) drift by exactly 1/255**, all in the near-black range where sRGB's transfer curve is steepest relative to an 8-bit step — inherent to canonicalizing through OKLCH in float64, and imperceptible. The check is now **deterministic** (a fixed 4-step grid) and asserts the real bound (max drift ≤ 1/255, affected fraction well under 0.1%) plus exact round-trips for the colours anyone actually authors. Behaviour documented on `formatHex`. Determinism of builds is unaffected.

## Two things worth recording
- **`hsl(120 100% 25%)` renders `#007f00`, not `#008000`.** Not a bug: that colour is exactly `rgb(0, 127.5, 0)`, and the 0.5 tie lands below 128 after OKLCH canonicalization. `#008000` is a *different* colour (128). Hex round-trips losslessly, which is the contract that matters.
- **ir.md was overclaiming.** It already said "any CSS color syntax accepted" — false before this change, and still not literally true. Rewritten to enumerate exactly what parses and what doesn't.

## Docs
ir.md (values), diagnostics.md (TST1106 fix hint), authoring-tokens.md (supported `$type` values), adopt-existing.md (step 1 — "paste whatever your stylesheets already contain").
