# Worklog — code blocks: overflow affordance + a snippet that fits

**Feedback (maintainer):** "the right part of code snippets is weird as there's no padding or gradient something" — with a screenshot of the showcase token card clipping mid-line at the rounded edge.

## Root cause, and why it looked broken
The block was genuinely wider than its column, so `overflow-x: auto` hard-clipped it at the border radius with **no signal that it was scrollable**. A hard clip mid-token reads as a rendering bug, not as "scroll me".

## Fixed both ends

**Make the common case fit.** The showcase snippet was one-lined (`"primary": { "solid": { "$value": "…" } },` ≈ 68 chars) inside the narrowest column on the page. It is now expanded across lines, and the showcase's code column widened from `minmax(16rem, 1.1fr)` to `minmax(18rem, 1.25fr)`. That block now fits with no scrolling at all — verified.

**Give real overflow a real affordance.** `.code-wrap::after` is a right-edge gradient that:
- appears **only** when the block actually overflows (`.overflowing`, measured from `scrollWidth - clientWidth`);
- **clears at the scroll end** (`.at-end`), so it never implies content that isn't there;
- fades to **the block's own background** — the script lifts Shiki's `--shiki-light-bg`/`--shiki-dark-bg` off the `<pre>` onto the wrapper, so it tracks the highlighter in both themes rather than guessing a colour (with a `--code-bg` fallback for the hand-built hero terminal, which has no Shiki vars);
- sits *below* the copy button (`z-index`).

State is re-synced on scroll, on resize, and **after `document.fonts.ready`** — the first measurement can otherwise run on fallback font metrics and mislabel a block in either direction.

## One rule removed rather than forced
I initially added `.code-wrap.overflowing pre { padding-right: 3.25rem }` for breathing room. Measurement showed it never applied: Astro's scoped `.transform pre[data-astro-cid-…]` has equal specificity and wins on order. Rather than escalate with `!important`, I checked whether it was needed — at the scroll end the block's own `padding-right` (20.8px) **is** respected and the fade has already cleared, so the last characters are never obscured. The rule was deleted and the reasoning left as a comment; a rule that silently does nothing is worse than no rule.

## Verified
Homepage: showcase block no longer overflows; the still-wide block gets the fade with the correct `#24292e` in dark. Docs (`getting-started`): 8 blocks, 5 overflowing at that width, every Shiki block carrying its bg var, gradient resolving to a real colour. Scroll-to-end clears the fade. Zero console errors, `check:all` 58 ✔.
