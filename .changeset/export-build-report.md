---
'@transtyle/core': patch
---

Export `buildReport()` from `@transtyle/core`.

The function that builds a target's `report.json` object now lives in `packages/core/src/report.js` and is public: `buildReport({ target, options, coverage, reads, normalized, diagnostics, suppressed, files })` returns the object `transtyle build` writes (with `normalized`, rows carry their slot's `$description` and `$deprecated`), so a tool that compiles with `emit: false` gets the same report without writing files. `compile()` uses it; the reports it writes are unchanged. `REPORT_SCHEMA_ID` is exported with it. The package README's example, which read a `result.report` that `compile()` never returned, now builds a report this way.
