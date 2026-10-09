---
'@transtyle/core': minor
'@transtyle/exporter-bootstrap': patch
'@transtyle/exporter-shadcn': patch
'@transtyle/exporter-daisyui': patch
'@transtyle/exporter-css-variables': patch
---

Add `targets.<t>.modes` to emit only some mode values for a target.

A project declares its modes once and every target used to receive the whole matrix, so a light-only Bootstrap site next to a light+dark shadcn app meant a second config or unwanted dark blocks. A target can now narrow it: `"bootstrap": { "modes": { "color-scheme": ["light"] } }` keeps only that value (a dimension you don't name keeps all of its values). Derivation and checks still run once on the full matrix; the exporter receives only the kept combinations, so a single-value dimension behaves like today's single-mode projects. A subset that names an undeclared dimension or value, or leaves out the dimension's default, is the new error `TST1308` and nothing is emitted for any target. A dimension narrowed this way is a deliberate exclusion: no `dropped` coverage row, and the target's `usage.md` lists the modes its files contain. The Bootstrap, shadcn, daisyUI and css-variables `usage.md` no longer describe a dark mode they didn't generate. The config JSON schema gains the `modes` target key.
