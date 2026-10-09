---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Authoring completeness levels: `minimal`, `recommended` and `complete` say which slots are worth authoring next, in the order they pay off. `build` and `check` print one `authored n/m <level>` line (level from the new `check.completeness`, default `recommended`); `transtyle check --completeness <level>` lists the items left, each `missing`, `derived`, `defaulted` or `carried-over` with why it matters, and `check --json` carries them under `completeness`. Advice only: the exit code doesn't change. Core exports `completenessStatus()` and `completenessLevels()`.

`derivation.require` accepts `"completeness:<level>"`, which fails with `TST1202` for each item of the level left, dark neutrals included. It also now fails on a required token that is `defaulted` (it only caught `derived` or absent ones before), so a project that required a slot it never authored, such as `semantic.space.4`, gets a `TST1202` it didn't get before: author the token, or drop it from `require`.
