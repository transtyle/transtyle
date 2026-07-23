# Worklog — replace the invisible vignette with an actual chevron indicator

**Feedback (maintainer, second screenshot, same block):** "Still broken." Correct — the inset-shadow vignette from the previous fix was too subtle to register against colourful syntax-highlighted text. Reproduced it live myself (screenshot, dark theme) before touching anything: a faint darkening was technically present but not a real affordance.

## What changed

Removed the box-shadow vignette experiment entirely rather than keep tuning it — colour-based cues (same-colour fade, then a muted-colour shadow) had now failed twice, both times because they compete for attention with the code's own syntax-highlighting colours, which vary block to block and can't be reliably out-contrasted by a fixed CSS colour choice.

Replaced with a **shape-based signal**: `.code-wrap.overflowing::before` renders a `›` chevron, vertically centred at the right edge, in `--text-muted` with a small blurred text-shadow "halo" in the block's own background colour (so it stays legible even sitting on top of similarly-toned text). A shape doesn't have the colour-matching problem a tint does — it reads as "more" regardless of what's directly behind it. Clears via the same `.at-end` class the fade already used.

## Verified by eye this time, not by computed style alone

Screenshotted both themes after rebuilding — the chevron is unmistakably visible in both, a clear glyph rather than a marginal tint. Confirmed via JS: appears only on the genuinely-overflowing block (a non-overflowing sibling has no `::before` content), and clears (`opacity: 0`) once `pre.scrollLeft` reaches the end. `check:all`: 58 ✔ (after formatting this file itself — same `check:format` gap as last commit, now habitual to check before committing).

**Lesson carried forward:** the previous two attempts were both signed off on `getComputedStyle` assertions (opacity, background-image, box-shadow strings) without an actual screenshot — which is exactly how a "technically correct, practically invisible" fix slipped through twice. Screenshot before claiming done, every time, for anything about _visibility_ rather than _behaviour_.
