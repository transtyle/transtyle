# `check:docs` now verifies diagnostic severity, not just presence

Section 4 of `check-docs.mjs` proved every `TST\d{4}` code emitted in
`packages/*/src` is documented in `diagnostics.md`, and vice versa — but only
presence. It could not have caught last commit's actual change: `TST1112` was
promoted from `warning` to `error` in `normalize.js`, and the docs table's
Severity column would have silently kept saying "warning" if I hadn't manually
edited it. A presence check can't see a severity drift because the code is
still there either way.

## What changed

`check-docs.mjs` now extracts, per code:

- **from source**: the severity of the `diagnostics.warn/.error/.info(code, ...)`
  call that emits it — matched loosely as `.(warn|error|info)\(` rather than
  anchored to a literal `diagnostics.` prefix, because `packages/ir/src/index.js`
  emits `TST1111` through `diagnostics?.warn(` (optional chaining, since IR's
  archetype collector is called with a diagnostics param that isn't always
  provided). All 23 codes currently emitted resolve to exactly one call site
  each — a code with no severity match, or with more than one distinct
  severity across call sites, fails the check rather than being silently
  skipped, since the docs table has no way to represent that.
- **from `diagnostics.md`**: the Severity column of each code's table row
  (`| \`TSTxxxx\` | <severity> | ...`).

A mismatch fails the build with the exact code and both values, e.g.:

```
- diagnostics: TST1112 is documented as "warning" in diagnostics.md but
  source emits it as "error"
```

Verified by reverting the `TST1112` docs row to "warning" and confirming the
checker names exactly that.

`check:all` green at 63.
