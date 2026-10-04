---
'@transtyle/core': patch
'@transtyle/cli': patch
'@transtyle/exporter-css-variables': patch
'@transtyle/exporter-primeng': patch
---

Parse authored DTCG composites member by member.

An authored `shadow` such as `elevation.1.shadow` used to reach the exporters with its `color` still a string, and css-variables shipped `oklch(NaN NaN NaN)` without a diagnostic. NORMALIZE now parses `shadow`, `typography`, `border` and `transition` members by their DTCG types: colors become OKLCH, member aliases resolve per mode (after DERIVE when they name a derived slot such as `{semantic.color.scrim}`), and a malformed or missing member is `TST1106` under its own path (`semantic.color.elevation.1.shadow.color`). A `shadow` may be an array of layers, with `inset`.

css-variables and PrimeNG render stacked and inset shadows; css-variables renders authored `border` and `transition` composites as their CSS shorthands. `transtyle explain` lists an authored composite's members and the alias each came through.
