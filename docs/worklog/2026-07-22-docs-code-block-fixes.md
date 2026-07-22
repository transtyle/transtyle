# Worklog — docs pages: fix code-block radius duplication + a near-invisible fade

**Feedback (maintainer, with screenshot):** `getting-started` rendering looked "weird" / "simple code snippets seem broken" — trailing comments hard-clipped with no visible affordance, unlike the homepage.

## Two real bugs, found by reproducing live rather than guessing from source

**1. `.prose pre` never got today's earlier radius-consolidation fix.** Earlier today I made `.code-wrap` the single owner of the rounded frame for the homepage's code blocks (`.transform pre`, `.show-src pre`, `.band.final .start pre`) — but `.prose pre` (the actual docs-page rule) still carried its own independent `border: 1px solid; border-radius: 10px`, sitting inside `.code-wrap`'s 12px radius + `overflow:hidden`. Confirmed via computed styles (`preRadius: 10px` next to `wrapRadius: 12px`) and visually — a rounded-corner artifact peeking past the block's own border at the top/bottom-right, the same "radius with no matching container" class of bug fixed once already, just not extended to docs pages. Fixed by stripping the border/radius from `.prose pre`, exactly as done for the homepage variants.

**2. The fade was real but functionally invisible on light-theme docs.** Verified via a solid-red debug override (injected `.code-wrap::after { background: red !important }`, screenshotted, removed) that the overlay does paint correctly — position, opacity, stacking order were all fine. The actual problem: `getComputedStyle` showed the fade's destination colour and the code block's own background were **identical** (`rgb(255,255,255)` on both, Shiki's light theme). A same-colour fade against a same-colour background provides zero visible signal — the text does get obscured, just too gradually to read as "this is fading," which is exactly what "seems broken" describes.

Added a second, colour-independent cue: `.code-wrap.overflowing` now carries an additional inset shadow (`-14px 0 10px -10px`, blended from `--text-muted`) alongside the existing same-colour fade — a vignette that darkens the edge regardless of whether the underlying colour happens to contrast with anything. The hero terminal gets its own version (plain black at low alpha, since it has no ring to combine with). Confirmed visually in both themes: light shows a soft grey shadow at the edge, dark shows a stronger, clearly legible darkening — both now read unambiguously as "more here."

## Verified

- Computed styles: `pre` in docs pages now has `border-radius: 0`, `border: none` — `.code-wrap` (12px, `overflow: hidden`) is the sole frame.
- The vignette only appears on the truly-overflowing wrap (checked a non-overflowing sibling reports no `-14px` shadow — no false positive).
- Screenshots in both themes confirm the corner artifact is gone and the fade is now a genuinely visible cue, not just a theoretically-correct one.
- Homepage re-checked: 5 wraps, 4 overflowing, terminal's separate shadow rule intact, zero console errors.
- Caught my own new worklog file failing `check:format` (written via heredoc, never piped through Prettier) — formatted it before this commit; a small live proof that the check does its job.
- Full `check:all`: 58 ✔, exit 0.
