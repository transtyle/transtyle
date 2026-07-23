# Worklog — two more code-block bugs: false-positive fade + a real margin gap

**Feedback (maintainer):** "still broken" on `/docs/getting-started`, homepage OK; then, mid-fix, "there's an extra top/bottom black padding." Two distinct, real bugs, both confirmed live before touching code.

## Bug 1: the affordance itself was obscuring already-visible text

The "1. Clone and link" block measured `scrollWidth: 430` vs `clientWidth: 426` — a **4px** overflow, half a monospace character at this font size (measured via canvas: ~8.16px/char). The fixed 48px fade+chevron still fired for it (the `> 1` threshold from the earlier fix), painting a 48px overlay across text that was already almost entirely visible — hiding far more than the real ~4px gap justified. This is a different failure mode from the last two fixes: not "invisible affordance" but "the affordance is now the thing breaking a block that didn't need one."

Fixed in `Base.astro`'s `syncOverflow`:

- Raised the meaningful-overflow threshold from `1px` to `6px` (safely under one character), so font-metric rounding noise no longer triggers the fade/chevron at all.
- Capped the fade width to `min(48, overflowAmount + 12)` via a per-block `--fade-w` custom property, so a real-but-small overflow gets a proportionally small overlay instead of always the full 48px. Large overflows (200–350px, seen on real blocks) still saturate at 48px, unchanged.

Verified: the git-clone block no longer gets `.overflowing` at all and renders the complete URL with no clipping; the genuinely 347px-overflowing block still shows `.overflowing` with `--fade-w: 48px`. Swept every `.code-wrap` on `getting-started`, `your-first-build`, and the homepage — no other false positives, no regressions on real overflows.

## Bug 2: a real ~13.6px top/bottom gap on every docs-page code block

Measuring the SAME block turned up something unrelated to the fade: `.code-wrap`'s own box was **27px taller than its `pre` child** (13.6px top + 13.6px bottom). Root cause: every _other_ `pre` rule on the site explicitly resets the browser's default `pre { margin: 1em 0 }` — `.terminal pre`, `.transform pre, .show-src pre`, and `.band.final .start pre` all carry `margin: 0` — but `.prose pre` (the actual docs-page rule) never did. `.code-wrap` has no background of its own (by design, so it never needs to match Shiki's colour), so that unreset margin showed through as bare page background sandwiching the code's own surface — exactly "extra black padding" on a dark theme, and the reason the homepage (whose rules all zero the margin) never showed it while every docs page did.

Fixed with one line: `margin: 0` added to `.prose pre`, with a comment explaining it's load-bearing, not tidying, given how easy it would be for a future edit to drop it again without understanding why.

Verified: wrapper and `pre` heights are now identical (`102.5px` both, was a 27px mismatch) on the previously-broken block; screenshotted in dark theme — no visible gap on either code block on the page.

## Process note

Both bugs were found by reproducing the maintainer's report live and measuring, not by re-reading my own CSS and reasoning about what it _should_ do — the lesson from the last two rounds held.
