---
'@transtyle/core': patch
---

A role whose `.solid` is an alias to a slot the engine derives now gets its full grid.

Binding `semantic.color.secondary.solid` to `{semantic.color.info.solid}` (or to another role's derived cell, like `{semantic.color.primary.solid-hover}`) resolved to the right colour, but the role's hover, tint, outline, on-colours and text cells were never derived, and nothing said so. DERIVE now reads such an alias as soon as its target exists, and retries a role whose target comes later in role order, so the grid is derived whatever the order. The same fix materializes component slots whose semantic source is bound to a derived scale step (`semantic.radius.control: "{semantic.radius.full}"` now gives `component.button.radius`). An archetyped role bound this way no longer raises `TST1203` ("no authored `.solid`"). A binding to a slot derived too late to feed it (a role bound to `ring`, `link.*` or `palette.categorical.*`, or `text.base` bound to a role cell) still resolves, and the new warning `TST1205` names what was not derived. Design systems that alias no derived slot compile exactly as before.
