---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Draft the bindings of an existing design system with `transtyle bind --suggest`.

For every catalog slot nothing binds yet (the role `.solid`s but `neutral`, the text rungs, `elevation.0/1.surface`, `border`, `ring`, `link.*`, the fonts), it proposes the project token that fills it, read from the token's name with a versioned table (`synonyms@1`) and from its color in every mode (the page, a border, body text, a status hue, the distance to what derivation would give the slot). Each proposal carries a confidence (`high` when name and value agree) and its reason; two candidates nothing separates are reported as contested and never written. stdout is an alias token file with the reasons in `$description`, `--rules` prints the same proposals as `bindings` rules for the config, `--json` the whole report. Deterministic and offline: no model, no network, byte-identical on every run. The same report is `suggestBindings({ cwd })` in `@transtyle/core`.
