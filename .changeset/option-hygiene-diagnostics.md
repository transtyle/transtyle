---
'@transtyle/core': minor
---

`check` now reports unused and duplicated option tokens.

`TST1114` lists `option.*` tokens that no alias resolves to, and `TST1115` groups option tokens of one type that resolve to the same value (colors compare in OKLCH within a tolerance far below a visible difference). Both are `info` by default, so `failOn: warning` CI is unaffected, and are reported once per build with the count and the first paths in the message; the full lists (`paths`) are on the diagnostic in `check --json` and `report.json`. A new `check.hygiene` config block, `{ "unusedOption", "duplicateOption" }`, sets each to `info`, `warning` or `off`. Three of the four examples carry unused options (acme 3, govuk 8, carbon 2), now reported as `info`.
