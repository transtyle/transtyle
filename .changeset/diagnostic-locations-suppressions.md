---
'@transtyle/core': minor
'@transtyle/cli': minor
---

Diagnostics about authored tokens now carry their source location, and known warnings can be suppressed with a reason.

A diagnostic gets `path`, `file`, `line` and `column` (1-based, the key's position) in `report.json` and `check --json`, and `transtyle check` prints them after the code (`✖ TST1105 tokens/brand.tokens.json:17:9 Dangling alias …`). A syntax error (`TST1002`) names the line the parser stopped at; a token defined in two files (`TST1103`) points at the later definition. A value Transtyle derives has no source line, so its diagnostics print as before.

`check.suppress` takes entries `{ code, path?, reason }` to silence a warning or info. `reason` is required and must not be blank; `path` is an exact token path or a prefix ending in `.*`; without `path` the entry matches every diagnostic with that code. A suppressed diagnostic stops being printed and counted by `check.failOn`, and is listed with its reason under the new always-present `suppressed` array of `report.json` and `check --json`. Errors cannot be suppressed. An entry that silenced nothing raises the new `TST1012` (info). The config and report JSON schemas are updated.
