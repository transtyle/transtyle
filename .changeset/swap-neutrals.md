---
'@transtyle/core': minor
'@transtyle/cli': patch
---

A design system that authors `semantic.color.text.base` with no dark value and leaves `semantic.color.elevation.0.surface` out no longer gets its light text on the default dark page (black on black, `TST2101` at about 1:1).

DERIVE now swaps the light pair into dark mode, rule `swap-neutrals` (`derived`): the dark page takes the light text color and the dark text takes the light page, so dark mode has light mode's exact contrast ratio. It works the other way for a dark-native system's light mode. A new `info` diagnostic, `TST1206`, says when it happened. An authored page, with or without a dark value, and a text color with its own dark value (on the slot or on the token it aliases) are never touched, so design systems that author their dark neutrals get byte-identical output.

`explain` now follows a rule that reads another mode into that mode and names it (`inputs: semantic.color.text.base (light) = …`): the swap's inputs, and `text.inverse`'s, which used to show the current mode's `text.base` instead of the one it copies. `explainToken()` gives those inputs a `mode`.
