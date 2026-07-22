# Worklog — fix the floating border-radius + widen the overflow-fade tail

**Feedback (maintainer, with screenshot):** "there's a border radius within a container not having one. And after the gradient (on the right end), we can distinguish the letters (without gradient)".

## Bug 1: a rounded corner with no container to belong to
`.code-wrap::after` (the overflow-fade overlay) declared its own `border-radius: 0 12px 12px 0`, but `.code-wrap` itself — the actual box that positions it — had no radius and no `overflow:hidden`. Two independently-rounded shapes (the inner `pre`, styled per-context with its own `border-radius: 12px`, and the `::after` overlay) with nothing forcing them to agree on size or position. Any sub-pixel mismatch between them shows up exactly as described: a rounded corner floating against a square edge.

**Fix: single owner of the shape.** `.code-wrap` now carries `border-radius: 12px; overflow: hidden` plus the inset ring (moved here from the per-context `pre` rules). `::after` is a plain rectangle with no radius of its own — the wrapper's `overflow:hidden` clips it into the correct shape automatically, so there is no second radius left to drift. Stripped the now-redundant `border-radius`/`box-shadow` from `.transform pre, .show-src pre` and `.band.final .start pre`.

The hero terminal is the one exception: `.terminal` already owns a rounded frame one level up (14px, `overflow:hidden`, wrapping the title bar *and* the code together). Adding a second radius on its `.code-wrap` would double up right where the two meet, so `.terminal .code-wrap` is explicitly neutralised (`border-radius: 0; overflow: visible`) and inherits its shape entirely from the ancestor's clip.

Verified via computed styles: every non-terminal wrap reports `border-radius: 12px` / `overflow: hidden` with `::after`'s own radius at `0px`; the terminal wrap reports `0px` / `visible`. No more independent radius anywhere but the one place that owns it.

## Bug 2: legible letters past the gradient
The old stops were `transparent → bg 85%` inside a 3rem (48px) box — only the last 15% (~7.2px) was fully opaque, thinner than one monospace character. A glyph sitting right at the edge was still fully readable through the "almost transparent" tail. New stops: `transparent → bg 45% → bg` — a flat, fully-opaque tail from 45% to 100% (~26px, roughly three characters), enough room to actually hide a glyph rather than merely tint it.

## Verified
`check:all` 58 ✔. Homepage and `getting-started` (8 blocks) both confirmed via computed styles: wrapper owns radius+overflow, `::after` has no radius, gradient's full computed value is `linear-gradient(to right, rgba(0,0,0,0), rgb(36,41,46) 45%, rgb(36,41,46))`. Zero console errors.
