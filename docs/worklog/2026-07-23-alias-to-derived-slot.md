# Fix: authored aliases into DERIVE-materialized slots

Follow-up to AL1.5's first logged engine finding ([worklog](2026-07-23-al15-al16.md)), fixed on maintainer instruction before AL2 designs around it.

## The bug

`component.button.radius: "{semantic.radius.full}"` failed with `TST1105 Dangling alias`. NORMALIZE resolved every authored alias eagerly, but `radius.full` doesn't exist yet at that point — DERIVE materializes it from `radius.md`. Aliases into always-present scales (`{semantic.space.6}`) worked, so the failure looked arbitrary from the outside: two neighbouring lines in the same token file, one legal and one not, with nothing in the authoring model to explain the difference.

It mattered because this is precisely the authoring style [ir.md](../architecture/ir.md)'s component-tier sketch uses (`{semantic.radius.interactive}`), so the component layer's documented ergonomics were unreachable in practice. AL1.5 worked around it with a literal `9999px`.

## The fix

Three small changes, no new concepts:

1. **[normalize.js](../../packages/core/src/normalize.js)** — an alias whose target is _absent from the map_ is no longer an error; the entry is marked `pendingAlias` and `resolveEntry` returns a `DEFERRED` sentinel that propagates through alias chains. A target that is _present but unresolvable_ (bad color syntax, cycle) still fails immediately, exactly as before — so the `TST1106`-cascade behavior the P4 run documented is unchanged.
2. **New `resolveDeferredAliases()`**, run in [index.js](../../packages/core/src/index.js) between DERIVE and CHECK: resolves pending entries (recursively, cycle-guarded) now that derived slots exist, and raises `TST1105` for anything still missing — same code, same message, later stage.
3. **[derive.js](../../packages/core/src/derive.js)** — `resolve()` now skips slots carrying a `pendingAlias`. Without this the component-tier loop would have filled `component.button.radius` with its semantic default while the authored alias sat waiting, silently discarding what the author wrote. This was the subtle half of the fix.

## Verification

- `component.button.radius: "{semantic.radius.full}"` in Acme → `9999px`, `explain` reports `aliased → semantic.radius.full`, and `$btn-border-radius: 9999px` reaches the emitted Sass.
- A genuine typo (`{semantic.radius.nope}`) still errors `TST1105` and does **not** fall back to the catalog default.
- `check:component-tier` now guards both halves permanently, with a new `packages/core/test-fixtures/component-dangling` fixture for the typo case; the check's success line states the new guarantee.
- `check:all` green (59 checks); no emitted output changed except Acme's intended `$btn-border-radius`.

Docs: [ir.md](../architecture/ir.md)'s References bullet states the deferral rule and its two invariants (dangling is still an error; authored still wins); the website [diagnostics page](../../website/src/docs/diagnostics.md) answers the user-facing question directly ("aliasing a derived slot is fine").
