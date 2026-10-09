---
'@transtyle/ir': minor
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/exporter-css-variables': minor
'@transtyle/exporter-shadcn': minor
'@transtyle/exporter-daisyui': minor
'@transtyle/exporter-bootstrap': minor
---

Carry DTCG `$description` and `$deprecated` through to the outputs.

Both fields used to load and then disappear. A token's `$description` is now written as a comment line above its variable in css-variables, shadcn and daisyUI (and above Bootstrap's `$primary…$danger`), added as `description` to the matching items of every `report.json`, and printed by `transtyle explain` under the value line. `$deprecated` (`true` or a reason, inherited from its group, `false` to opt out) reaches the same places, and a semantic or component slot whose value still comes from a deprecated token warns `TST1122` with the reason as the hint; every target's `usage.md` lists those variables under "Deprecated tokens", and their report items carry `deprecated` and `deprecatedBy`. A `$description` that isn't a string, or a `$deprecated` that isn't `true`, `false` or a string, warns `TST1311` and is ignored. Design systems that describe their tokens (GOV.UK and Carbon among the examples) see new comment lines in those files; nothing else changes. Exporter authors read `entry.description` and `entry.deprecated`, with `entryNotes()`, `blockComment()` and `lineComment()` from `@transtyle/ir`.
