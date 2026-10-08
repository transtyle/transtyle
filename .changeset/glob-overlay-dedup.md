---
'@transtyle/core': patch
---

A `tokens` glob that also matches a mode-scoped overlay no longer loads that file as a base layer.

With `["tokens/*.tokens.json", { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }]`, `dark.tokens.json` was loaded twice: as the dark overlay, and as one more base layer. Its dark values overwrote the light ones, and every token in it raised `TST1103`. The overlay now claims its file whatever the order of the entries, so the glob skips it: light mode keeps the base values, and the `TST1103` warnings go away. Configs that list their base files one by one compile exactly as before.
