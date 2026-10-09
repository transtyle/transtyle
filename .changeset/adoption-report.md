---
'@transtyle/core': minor
'@transtyle/cli': minor
---

`check` now ends with an adoption report, and notes false-friend bindings.

The report counts the project's own `semantic.*` tokens (paths that are not catalog slots), says how many a catalog slot reads (following the alias chain, in every mode) and lists the ones none reads: they reach css-variables verbatim and no other target. Each comes with hints, the catalog slots already set to the same value or the slot whose name it shadows (`semantic.color.surface` → "did you mean to author `elevation.0.surface`?"). Custom roles are listed apart. `check --json` carries it as `adoption: { custom, bound, unbound: [{ path, type, hints }], roles }`; `@transtyle/core` exports it as `adoption(normalized)`, with `isCatalogSlot(path)`. On the examples, GOV.UK lists `govuk.focus-text` ("same value as `text.base`"), Cathode prints "7 custom tokens, all bound; 1 custom role (`crt-amber`)".

New `TST1124` (`info`): `secondary.solid` bound to a token named `secondary` whose colour is within ΔE 0.05 of `neutral.tint` (shadcn's `--secondary`, a subtle gray), or `accent.solid` bound to an `accent` token within 0.05 of `primary.tint` or `neutral.tint` (shadcn's `--accent`, a hover wash). None of the four examples raises it.
