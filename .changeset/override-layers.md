---
'@transtyle/core': minor
---

Add explicit override layers to the `tokens` manifest.

A layer written `{ "files": "tokens/product.tokens.json", "override": true }` may redefine tokens from earlier layers without `TST1103`, so intentional core, business-unit and product layering no longer warns as duplicates; an unmarked duplicate still does. A marked layer that defines a token no earlier layer defined gets the new `TST1116` warning (a likely typo), unless it is marked `"override": "extend"`. `override` also silences `TST1108` on a mode-scoped layer. `transtyle explain` prints `overrides <file>` for a token an override layer replaced. The object form of a layer now needs `mode` or `override`; the config JSON schema is updated.
