# 2026-07-21 — C2: component-tier engine resolution

Per [docs/plan/component-tier.md](../plan/component-tier.md) C2. Independent of C1 (the cross-ecosystem study, still open) — this task only had to prove the _engine_ handles a `component.*` tier at all, generically, not specific to any one target ecosystem or component.

## What shipped

- **`COMPONENT_CATALOG`** (new, `packages/ir/src/index.js`) — button only, three tokens (`radius`, `padding-x`, `padding-y`), each declaring a `type` and a `defaultFrom` semantic path. Deliberately scoped to one component, not the full `component-layer.md` sketch — C4 extends this per component only once its real shape is checked against source.
- **`derive.js`** — a new resolve-or-fill loop at the end of the per-mode pass, iterating `COMPONENT_CATALOG` and calling the existing `resolve()` helper to alias each `component.<name>.<token>` from its declared semantic default. No new resolution machinery — this reuses the same `resolve(ctx, path, type, compute, rule, inputs)` primitive every other catalog slot already goes through.
- **`scripts/check-component-tier.mjs`** (new) + `npm run check:component-tier`, added to `check:all` — asserts (a) Acme, which authors zero `component.*` tokens, still resolves `component.button.{radius,padding-x,padding-y}` to their semantic defaults in both light and dark, and (b) a new fixture (`packages/core/test-fixtures/component-tier/`) that authors `component.button.radius: 2px` resolves to `"2px"` with `provenance.kind === "authored"`, not the default.

## The one deviation from the plan's file list

The plan listed `packages/core/src/normalize.js` as a file this task might need to touch. It didn't: normalize.js's `collectTokens()` tree walk is already generic over top-level tier names (`option`/`semantic`/`component`/...), confirmed by grep rather than assumed — zero existing "component" references anywhere in `normalize.js`, `index.js`, or `checks.js`, and none were needed. The "authored always wins" half of the acceptance criteria was free: an authored `component.*` token already survives the walk untouched before `derive.js` ever runs, identical to how an authored `semantic.*` token would.

## Verification performed before committing

- `node scripts/check-component-tier.mjs` — both assertions pass.
- `npm run check:all` — clean, including the new `check:component-tier` step; no change to any `semantic.*` resolution or existing fixture value.

## Scope not touched

C1 (cross-ecosystem study) remains open and was not a blocker — C2 only needed the engine to prove it can resolve _a_ component tier generically, not to settle which vocabulary belongs in it. C3 (the PrimeNG severity-grid mapper) and everything downstream is still unstarted.
