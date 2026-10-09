---
'@transtyle/plugin-kit': minor
---

`conformance()` now runs your exporter against nine fixture design systems instead of one: the canonical one, plus one token, three tokens, `color-scheme` × `density`, light only, an authored component tier, a custom archetyped role, authored composites and DTCG object forms. Five checks join the suite: `files-non-empty`, `no-leaked-values` (no `undefined`, `null`, `NaN` or `[object Object]` in a file), `coverage-honest` (no `native`/`derived` row for a slot that has no value), `mode-dimensions-accounted` (a `density` mode is emitted or reported as a `(mode:density)` `dropped` row) and `structured-values-as-strings` (object-form tokens give the same files as their CSS strings). Every per-IR check now carries the `fixture` it ran on.

This can fail an exporter that passed before. The common one is an exporter that compiles a single mode: add a `dropped` coverage row named `(mode:<dimension>)` for each dimension in `ir.dimensionNames` it does not follow. Pass `{ fixtures: 'canonical' }` to keep the old single-fixture run while you fix it, or an array of fixture names. `fixtureIR(name)` takes a fixture name (default `canonical`), `FIXTURES` lists them, and the leak patterns are exported as `LEAK` and `LEAK_INSIDE`. The bundled fixture moved from `fixture/` to `fixtures/canonical/`.
