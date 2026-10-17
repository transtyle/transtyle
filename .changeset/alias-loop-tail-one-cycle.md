---
'@transtyle/core': patch
---

Report an alias loop once, without the tokens that alias into it.

A token that points at a loop without being on it (`x` → `a`, with `a` and `b` aliasing each other) used to get a `TST1104` of its own, repeating the whole loop after its own name. `check` now prints one `TST1104` for the loop, `a → b → a`, located on `a`, and nothing for `x`: it has no value because of the loop, which the error already explains. A tail of N tokens used to print N + 1 errors whose length grew with N². Pure loops, self-references and every other diagnostic are unchanged.
