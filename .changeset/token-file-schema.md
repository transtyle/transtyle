---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Publish a JSON Schema for token files, so editors complete the catalog.

`https://transtyle.github.io/transtyle/schemas/tokens/v0.json` lists every built-in slot path (`semantic.color.primary.solid`, `component.control.padding-x`…) and offers them as alias completions in `$value`; a misspelled slot such as `primary.solidd`, or a value on a role group, is underlined. Custom tokens stay valid. The schema is generated from the catalog; `transtyle init` now writes the `$schema` line into the scaffolded token file.
