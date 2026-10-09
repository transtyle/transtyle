# Binding rules in the config (#59)

## The change

`transtyle.config.json` takes an optional `bindings` array of pattern rules
(`packages/core/src/bindings.js`). `compile()` expands them right after
`loadTokenTrees()` into one more base layer of plain aliases, so NORMALIZE, DERIVE,
the exporters and `diff` are untouched. The alias carries `provenance.rule`
(`bindings[<n>]: <slot pattern>`), which `explain` prints. `transtyle bindings
--expand` prints the layer as a token file. Design and alternatives:
[ADR-0012](../adr/0012-binding-rules.md); behavior:
[configuration.md#binding-rules](../specs/configuration.md#binding-rules).

## Deviations from the refinement

- Acceptance moved to a new fixture, as decided on the issue: six rules in
  `packages/core/test-fixtures/bindings-rules` build the same bytes as the 31
  plain aliases they expand to (`bindings-explicit`, which is the committed output of
  `bindings --expand`). `check:cli` compares css-variables, bootstrap and shadcn.
  Carbon is left as it is.
- Only `{role}`, `{rung}`, `{level}`; `{step}` is a later issue.
- Diagnostic codes: `TST1117` (malformed rule), `TST1118` (required target
  missing), `TST1119` (info: two rules bound one slot). The refinement said one
  new code for an unknown placeholder; a malformed `from` and an unknown role in
  `roles` are the same kind of mistake and share it.
- A rule that collides with an authored token is skipped silently, not noted: it
  is the intended way to override a cell. `bindings --expand` reports the count on
  stderr.
