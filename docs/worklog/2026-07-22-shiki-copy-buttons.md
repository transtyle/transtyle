# Worklog — Shiki everywhere + copy buttons on every code block

**Ask (maintainer):** improve the homepage's "You write / You get" cards — every place the docs show real code should use Shiki and be copy/pasteable.

## What was actually wrong

Markdown docs already got Shiki via `astro.config.mjs` (dual `github-light`/`github-dark`, `defaultColor: false`). The **homepage** did not: five hand-rolled `<pre><code>` blocks with manual `<span>` markup. And **nothing anywhere had a copy button**.

Worse, two of the homepage snippets were **invalid DTCG** — `"primary": { "solid": "{option.color.blue.600}" }` omits `$value`, which every other page teaches correctly. Since the ask was that they be pasteable, they had to be _right_ first.

## Changes

- **Homepage → Shiki.** The four genuine code blocks (authored tokens, derived CSS, showcase tokens, install commands) now use Astro's `<Code>` with the same theme config as the markdown pipeline, so homepage and docs render identically. Content rewritten to be **valid and pasteable**: both JSON blocks now `JSON.parse()` clean (verified in-browser) and use real DTCG `$value` syntax matching the Acme example; the CSS block is now valid CSS with comments instead of prose lines.
- **Hero terminal kept hand-built on purpose.** It's a transcript whose coverage percentages are coloured with the site's native/derived/approximated palette — a deliberate design element Shiki would flatten. It gets `data-copy` so the button yields just the command, not command + output.
- **Copy button on every block**, injected in `Base.astro` for markdown and homepage alike: wraps each block, copies `data-copy ?? textContent`, shows "Copied", falls back to "Press ⌘C" if the clipboard API is unavailable. Hidden until hover, shown on `:focus-visible` (keyboard-reachable), always visible on narrow screens.
- **Fixed a styling conflict the conversion created:** Shiki's background rule carries `!important`, so the terminal-styled `.start` wrapper would have painted a second background behind the highlighted block. It is now a plain centring container, and `.card pre`'s dead `background: none` was removed with a note explaining why it can't win.

## Verification notes

Verified in the preview: 5 wrapped blocks each with a button, real token spans, correct Shiki background in **both** themes (`#fff` light / `#24292e` dark), `.start` wrapper transparent, zero console errors, and both JSON blocks parsing.

Two false alarms worth recording so the next person doesn't chase them:

- The preview pane reports a **0×0 viewport**, so all `getBoundingClientRect` values are meaningless (everything measures 0-width, and the absolutely-positioned button appears at negative x). This is the harness, not the layout.
- A grep for non-Shiki `<pre` matched the literal text `<pre>` inside the copy-script's own **comment**. Comment reworded.
