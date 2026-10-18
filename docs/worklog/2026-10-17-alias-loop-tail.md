# A token that aliases into a loop is no longer a cycle of its own

`transtyle check` printed one `TST1104` per token upstream of an alias loop, each repeating the loop after its own name: with `x` → `a` and `a`, `b` pointing at each other, the first error named `x`, which is not on any cycle. A tail of N tokens printed N + 1 errors whose total length grew with N², the one part of alias resolution still quadratic after #97 (#204).

## What shipped

- `reportCycle()` in `packages/core/src/normalize.js` cuts the walked chain at the first occurrence of the repeated token, and uses that part for the message, the dedupe key and the diagnostic's location. Composite tokens on the walk's stack sit before that point and are cut the same way. Both callers, `resolveEntry()` (NORMALIZE) and `resolvePending()` (after DERIVE), get it.
- `resolveEntry()` records the loop's members from that cut part whatever the walk started from, so a later walk that starts on a loop member returns at once.
- `scripts/check-cli.mjs` gets four cases next to the #97 loop: a one-token tail gives one loop-only `TST1104` located on `semantic.chain.a` and no `TST1105`, two tails into one loop give one, and a 10,000-token tail gives one with a three-token message.
- The `TST1104` row of `website/src/docs/diagnostics.md` says that only the loop is listed. The tail bullet is gone from "Left as it is" in `docs/findings/performance.md`.

## Decisions

- Tail tokens get nothing, not an info line: their missing value is a consequence of the loop, as `TST1105` is already suppressed on top of `TST1104`, and a line per loop would bring back output that grows with the tail.
- Time stays quadratic in the tail (each tail token still walks down to the loop); only the output is linear now. Remembering which tokens lead into a reported loop would fix that without changing any output.
