---
'@transtyle/core': minor
---

Report `TST1113` when a `semantic.*` token aliases a `component.*` token.

The tiers layer option, semantic, component, and the semantic tier is the stable surface the component tier reads from; an alias pointing the other way inverts that and was silently accepted. It is now an error naming both tokens, with a hint, and nothing is emitted. Only the direct edge is reported (`semantic.a` to `semantic.b` to `component.c` names `semantic.b`), and `component` to `semantic` or `component` aliases are unaffected. No example authors such an alias, so existing builds do not change. `check:component-tier` covers the error, the chain and the legitimate layering; `check:plugins` and `check:minimal-ds` now also fail an exporter whose coverage binds an `option.*` slot.
