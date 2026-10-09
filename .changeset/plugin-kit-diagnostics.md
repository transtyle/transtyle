---
'@transtyle/plugin-kit': minor
---

`conformance()` accepts the optional `diagnostics` an exporter may return from `emit()`: a new `emit-diagnostics-valid` check (only when the plugin returns some) requires `{ severity: 'info' | 'warning', code, message, hint? }`, and `deterministic` now compares diagnostics as well as files. The README's usage example now reads the real return value (`{ pass, checks }`).
