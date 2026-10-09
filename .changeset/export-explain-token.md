---
'@transtyle/core': patch
'@transtyle/cli': patch
---

Export `explainToken()` from `@transtyle/core`.

The provenance walk behind `transtyle explain` now lives in core as `explainToken(normalized, slot, { mode })`, returning a JSON-serialisable tree (`{ slot, mode, entry, inputs }`) and throwing an `Error` with a `code` of `unknown-mode` or `unknown-slot`. The CLI is now a formatter over it; its output is unchanged.
