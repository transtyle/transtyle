---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Add APCA as a contrast standard: `check.contrast.standard: "apca"` checks with APCA 0.0.98G-4g (Lc 75 for body text, Lc 60 for secondary text and on-colors) and prints a signed `Lc` in `TST2101` and in `transtyle diff`. APCA comes from the `apca-w3` package, an optional peer dependency: install it in your project (`npm install --save-dev apca-w3`) to use it; without it the build fails with the new `TST1013` instead of checking under another standard. On-colors are picked with the same method (`derivation.contrast`, which follows the check standard unless set to `wcag21` or `apca`).

On-color contrast is now checked on resolved values with the other pairs, so two things change under WCAG too: `wcag21-aaa` applies its 7:1 to every `on-solid` and `on-tint` (they were held to 4.5:1 whatever the standard), and an authored on-color that fails is warned. Their `TST2101` message now reads like the others (`primary.on-solid vs primary.solid is 3.9:1 in light mode (< 4.5:1 wcag21-aa)`). `check --json` reports the standard it measured against (`contrast`), `diff --json` rows carry `unit` and `standard`, and `contrastRegressions` takes the `contrast` that `compile()` now returns.
