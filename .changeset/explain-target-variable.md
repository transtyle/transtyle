---
'@transtyle/cli': minor
'@transtyle/core': minor
'@transtyle/plugin-kit': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-primeng': minor
---

`transtyle explain` now goes both ways. `explain --variable '$btn-border-radius' --target bootstrap` starts from a target variable, follows the variables it is chained to, and explains each slot it reaches; `explain <slot> --target <t>` lists the target's variables that consume a slot. Both work without a prior build, and `--json` prints the data. The provenance tree now follows aliases to their target, so it always ends at what was authored. Core exports the lookups as `explainVariable()`, `slotConsumers()` and `coverageSlots()`; `explainToken()` lists an aliased entry's target as its one input.

Coverage rows gain two optional fields, `slots` (the IR paths a variable reads, when its `slot` label isn't one) and `via` (the variables it follows), declared in the report schema; plugin-kit's conformance suite checks that every `slots` entry exists in the IR. The Bootstrap exporter fills them for its chained, `var(--bs-*)`, member and transition rows, and the PrimeNG exporter reports its form-field, button and typography rows one variable per row (Acme: 349 rows become 356).
