---
'@transtyle/cli': minor
'@transtyle/core': minor
---

`transtyle init` asks for your brand color, color schemes, targets, a preset and a file layout.

In a terminal it asks; each question also has a flag (`--brand`, `--schemes`, `--targets`, `--preset recommended|minimal`, `--layout single|layered`, `--yes`), and without a terminal it asks nothing, so scripts and CI keep working. A bad value exits 2 before any file is written.

The default scaffold changes: the neutrals now take your brand's hue and get dark values in `tokens/brand.dark.tokens.json`, loaded as a mode-scoped overlay, so a new project's dark theme is no longer its light one. Token files are listed by name in `tokens` instead of the `tokens/*.tokens.json` glob. After writing, `init` checks the project and shows the brand color with its derived `on-solid` and their contrast ratio.

`@transtyle/core` now exports `parseColor`.
