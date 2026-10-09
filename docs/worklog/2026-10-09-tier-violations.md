# Tier violations: a semantic token cannot alias a component token

Issue [#8](https://github.com/transtyle/transtyle/issues/8). The validation spec
listed tier violations as specced but not implemented; only `TST1305` (a
top-level group that is not a tier name) existed.

## What shipped

- `TST1113` (error), `reportTierViolations()` in `packages/core/src/normalize.js`,
  called in `compile()` right after `resolveDeferredAliases()`, because only then
  does every alias, deferred ones included, carry its final provenance. A
  `semantic.*` token whose direct alias target is under `component.*` is
  reported once, naming both tokens, with a hint. A chain
  `semantic.a -> semantic.b -> component.c` names `semantic.b`.
- The exporter half became a contract check, not a user diagnostic. Exporters
  have no binding table to inspect; their coverage rows name the IR slot they
  read. Binding to `component.*` is legitimate (it is what the component tier is
  for), so the rule is "no coverage row names an `option.*` slot", enforced for
  all eight exporters in `check:plugins` (on the fixture IR) and
  `check:minimal-ds` (on every design-system shape). No exporter needed a fix.
- Tests: `check:component-tier` case (g) covers the error, the chain and the
  `component -> semantic` / `component -> component` positive control;
  `check:plugins` has a negative test proving the option-binding gate has teeth.

## Deviations from the issue text

- "An exporter's binding table pointing at a `component.*` slot" was corrected to
  `option.*`, for the reason above.
- Out of scope, noted: an `option.*` token aliasing `semantic.*` or `component.*`
  is also backwards. One more pair of prefixes in the same function.
