# A role bound to a derived slot got its colour but no grid

Fixes #126. [ir.md](../architecture/ir.md#values-and-canonicalization) says an
alias to a slot DERIVE materializes "is legal", and the binding layer invites
exactly that: "our secondary is the info blue" is one line,
`secondary.solid: "{semantic.color.info.solid}"`. It half-worked. The alias
resolved, but the role's grid (`solid-hover`, `tint`, `outline`, `on-solid`,
`on-tint`, `text`, `text-strong`) was never derived, and no diagnostic said so.

## The defect

NORMALIZE marks an alias whose target doesn't exist yet as `pendingAlias`, and
only `resolveDeferredAliases()`, after DERIVE, settles it. During DERIVE,
`resolve()` and `get()` read a pending entry as `undefined` without checking
whether the target had been filled in the meantime. `resolve()` returning
`undefined` is right (the authored alias must win over the role's default), but
the role loop then saw no solid and `continue`d. A built-in role took the
branch commented "only reachable if primary itself were missing"; an archetyped
role raised `TST1203` "no authored `<role>.solid`", which was wrong, since it was
authored.

Role order didn't matter: `info.solid → {secondary.solid}` failed the same way,
though `secondary` is derived first. Measured on `main` (a two-mode design system
with `primary.solid`, a surface and `text.base` authored, compiled in-process):

| Authored                                          | Grid before | Diagnostic before | After                  |
| ------------------------------------------------- | ----------- | ----------------- | ---------------------- |
| `secondary.solid → {info.solid}`                  | missing     | none              | full grid              |
| `info.solid → {secondary.solid}`                  | missing     | none              | full grid              |
| `accent.solid → {primary.solid-hover}`            | missing     | none              | full grid              |
| archetyped `brand2.solid → {info.solid}`          | missing     | `TST1203` (wrong) | full grid, no 1203     |
| `secondary.solid → {primary.solid}` (control)     | present     | none              | unchanged              |
| `secondary.solid → {ring}`                        | missing     | none              | missing, `TST1205`     |
| `secondary.solid → {nope.solid}` (dangling)       | missing     | `TST1105`         | unchanged              |
| `radius.control → {radius.full}`: `button.radius` | missing     | none              | `9999px`               |
| `text.base → {neutral.solid}`                     | ladder gone | none              | ladder gone, `TST1205` |

## The fix

- **`resolveIfReady()` in `normalize.js`** settles a pending alias when its
  target has a value now (following chains, cycle-guarded) and otherwise leaves
  it pending, without a diagnostic. The entry it produces is exactly what the
  post-DERIVE pass would have produced (same value, type and `aliased`
  provenance), so settling early moves nothing. Exported: #43's option-scale
  generator needs the same helper for aliases to generated steps.
- **DERIVE reads through it.** `get()` and `resolve()` call it, so a slot filled
  earlier in the pass is seen right away. That alone fixes the "target derived
  earlier" rows and the component tier, whose loop runs after the scales.
- **The role loop is a worklist.** A role whose `.solid` is still pending goes to
  the back of the queue and is retried once the rest has run; the queue stops
  when every role left in it has waited since the last grid was derived. Roles
  that alias nothing derived never wait, so their order and output don't move.
  [derivation.md](../architecture/derivation.md#how-it-works) said rules run in a
  fixed order, "not to a fixpoint"; the worklist is bounded and deterministic,
  and the page now names it as the one place the order adapts.
- **`TST1205` (warning)** reports what still can't be built: a role bound to a
  slot derived after every role grid (`ring`, `link.*`, `palette.categorical.*`,
  the content ladder) and `text.base` bound to a role cell (it is read before
  the grids, and the grids read it, so no order fixes it). DERIVE only records
  what it skipped; `compile()` reports it after `resolveDeferredAliases()`, and
  only for aliases that resolved in the end, one message per alias with its
  modes grouped. A first try emitted it inside DERIVE and it also fired on
  dangling aliases and alias loops, next to their `TST1105`/`TST1104`: the
  consequence printed beside its cause, which the
  [diagnostics page](../../website/src/docs/diagnostics.md) rules out.
- **`TST1203` keeps its meaning** and now fires only when the archetyped role's
  `.solid` is absent. Bound, it gets its grid or `TST1205`; bound to something
  that fails (`TST1104`/`TST1105`/`TST1106`), the cause is already reported.

## Deviations and side effects

- With `text.base` bound to a role cell, `text.inverse` is now derived: the
  cross-mode pass runs after the grids, so it reads the settled alias. It was
  missing before. The rest of the ladder still needs an authored `text.base`.
- A composite waiting on a member (`pendingMembers`, e.g. a shadow whose colour
  is `{semantic.color.scrim}`) is still settled only after DERIVE, as before.
  Nothing in DERIVE reads such a composite as an input today.
- Two roles bound to each other's derived cells
  (`info.solid → {secondary.tint}`, `secondary.solid → {info.tint}`) loop through
  derivation. They stay `TST1105` "Dangling alias", as before; a clearer "loop
  through derivation" message is left for a separate issue.

## Measured

The IR of all four examples (every combo: values, types, provenance and the
pending flags) and their diagnostics are identical before and after, compared
key by key in-process. No example binds a role `.solid` to a derived slot; Acme's
`component.button.radius → {semantic.radius.full}` is now settled during DERIVE
instead of after it, with the same entry.

`check:grid` gains section (d): the four bound cases above get every
`ARCHETYPE_CELLS` cell in both modes with no `TST1105`/`TST1203`/`TST1205`, and
hold their alias target's value; `secondary → ring` raises exactly one
`TST1205` naming both modes; a dangling target raises `TST1105` and no
`TST1205`. `check:component-tier` gains (f): `radius.control → radius.full`
gives `component.control.radius` and `component.button.radius` = `9999px`.
Verified red against the unfixed engine (ten `check:grid` failures, two in
`check:component-tier`).
