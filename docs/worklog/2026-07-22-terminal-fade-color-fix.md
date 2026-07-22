# Worklog — fix the hero terminal's mismatched fade colour

**Feedback (maintainer, with screenshot):** "the gradient is awful in light/dark mode" — on the hero terminal specifically.

## Root cause
The terminal's `<pre>` isn't Shiki-rendered (it's the hand-built coverage-coloured transcript), so it carries no `--shiki-light-bg`/`--shiki-dark-bg` custom properties for the fade to lift. The generic fade rule's fallback chain therefore bottomed out at `--code-bg` — a variable that is **not** the terminal's actual background and diverges from it in both themes:

| | `--code-bg` (the wrong fallback) | `--terminal-bg` (the real one) |
|---|---|---|
| light | `oklch(0.965 0.006 260)` — near-white | `oklch(0.2 0.02 262)` — dark navy |
| dark | `oklch(0.23 0.018 262)` | `oklch(0.14 0.014 262)` |

In light mode that's a near-white smudge painted over a dark box. In dark mode it's two visibly distinct dark shades sitting next to each other with a hard seam. Both read as broken, matching "awful in light/dark" precisely — this wasn't a matter of taste, the fade genuinely wasn't the box's own colour in either theme.

## Fix
Added `.terminal .code-wrap::after { background: linear-gradient(to right, transparent, var(--terminal-bg) 45%, var(--terminal-bg)); }`, placed after the `[data-theme='dark']` rule. `--terminal-bg` already varies correctly per theme on its own, so one rule covers both — but it ties in specificity with the dark-theme rule above it (class+class vs attribute+class), so source order is what makes it win in dark mode; noted in a comment so a future reorder doesn't silently break it again.

## Verified
Computed styles in both themes: the fade's solid stop and the terminal `pre`'s own `background-color` are now byte-identical (`oklch(0.2 0.02 262)` in light, `oklch(0.14 0.014 262)` in dark). The Shiki-rendered blocks (unaffected by this change) still match their own background exactly, confirmed the same way. Zero console errors, `check:all` 58 ✔.
