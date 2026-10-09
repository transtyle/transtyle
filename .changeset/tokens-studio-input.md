---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Load a Tokens Studio for Figma export as it is: `{ "tokensStudio": "tokens/figma", "themes": { … }, "sets": { … } }` in `tokens`.

The layer takes the folder the plugin syncs to (sets, `$metadata.json`, `$themes.json`) or a single-file export, and nothing in it is rewritten. Each theme group maps to a mode dimension (`map`, or `fixed` for a group compiled with one theme), each set is placed under a tier (`sets`, default `option`) with its references rewritten to match, and the themes are lowered to a base layer plus one mode-scoped layer per non-default mode, so the build is the one a hand-written DTCG layout gives. Tokens Studio's types, unitless pixels, Figma weight names, percentages, the legacy `value`/`type` format and `.value` references are read; math and references inside values (`{space.base} * 2`, `roundTo(…)`, `rgba({color.black}, 0.5)`) are evaluated per mode. `transtyle explain` names a token's set file and Tokens Studio path, per mode, and a math token's expression. New diagnostics `TST1003`–`TST1009` cover a broken export, an unmapped theme group, the legacy format, an expression outside the supported subset, a color modifier (refused: the plugin would output a different color), themes that per-mode layers cannot express, and lossy readings. Projects without this layer compile exactly as before.
