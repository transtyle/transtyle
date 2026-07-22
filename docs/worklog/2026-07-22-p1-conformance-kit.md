# Worklog — P1: plugin conformance kit + ADR-0011 reconciliation

**Task:** P1 (execution-2026-h2.md). Two deliverables: build the kit, and close the plugins.md-vs-reality gap ADR-0011 documented.

## The reconciliation decision (ADR-0011 §2)
Checked all eight exporters first: every one implements exactly `emit(normalized, ctx) → { files: [{path,contents,kind}], coverage: [] }` with identical manifest keys. The richer contract plugins.md specified — `resolve`/`doc` hooks, declarative `mappings/*.json` evaluated by core, semver-range manifests — was implemented by **nobody**. So the spec was **dropped to reality** rather than the implementation raised to unused prose. plugins.md's interface section now documents the real single-hook contract (with the rationale for it), the conformance table, and a usage example; the drift banner is gone. ADR-0011 annotated (still `proposed`); formal *freezing* of the plugin API remains R4-gated, which is parked.

## The kit
`packages/plugin-kit/` — `conformance(plugin, { manifest? })` resolves a bundled canonical fixture (brand color, both color-scheme modes, elevation/text/border/radius/fonts) via core, synthesizes the same ctx core passes at emit time, and runs 8–9 checks: interface shape, emit-runs, files/coverage return contracts, coverage-class validity, determinism (double-run diff), IR immutability (before/after snapshot), manifest validity, optionsSchema shape. Each check carries the spec reference it enforces, so failures point at the rule.

`scripts/check-plugins.mjs` gates all 8 official exporters, **plus an inline third-party plugin the kit has never seen** (proving the suite tests the contract, not shared built-in code), **plus a negative test** (a plugin with an invalid coverage class must be rejected — proving the gate has teeth). Wired into `check:all` and CI.

## Real bug found on first run
`exporter-primeng` used `field:` as its coverage-item key where the contract (and the R3 report schema) require `variable:` — 21 call sites. This had been silently emitting `report.json` files that **violated the published report schema by 520 errors per report**. Renamed carefully (the unrelated `radius.field` catalog slot and severity-grid's local `${field}` loop variable left intact). Primeng reports now validate at 0 errors.

## Hardening from that finding
The bug hid because R3's schema check validated exactly one report (shadcn's). `check-schemas.mjs` now validates **every** emitted `report.json` across all examples (33 today). That required reordering: `check:schemas` moved after the build steps in `check:all` so the reports it validates are always fresh — verified by deleting all `dist/` and re-running clean.

**Also fixed:** CI enumerates check steps individually rather than calling `check:all`, so `check:schemas` (added in R3) had **never actually run in CI**. Both `check:plugins` and `check:schemas` are now in `.github/workflows/ci.yml` in the correct order.

## Verified
`check:all` 54 ✔ exit 0, including from a clean state with all `dist/` deleted.

## Not done
P1's "runs from a separate npm-installed repo" acceptance is gated on publication (R4, parked); the inline third-party plugin proves the decoupling available today. `doc` hook remains reserved/unimplemented.
