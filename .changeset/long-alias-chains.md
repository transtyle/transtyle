---
'@transtyle/core': patch
'@transtyle/exporter-mantine': patch
---

Alias chains of any length resolve, and large design systems no longer hit quadratic slow paths.

An alias chain of about 4,500 links used to crash `transtyle check` and `build` with `Maximum call stack size exceeded` (exit 2, no diagnostic code, no token named): the resolver recursed once per link. Chains are now walked in a loop (and so is the walk that finds deprecated tokens a slot reaches), so any length resolves, with the same values, provenance and diagnostics as before. Four steps that grew faster than linearly are now linear: the out-of-sRGB check (`TST1120`) followed every chain again from each token on it (a 10,000-link chain took 50 s), a long alias loop was walked once per member before its `TST1104` (a 10,000-link loop took minutes), and duplicate option values (`TST1115`) were grouped by comparing each token with every group so far. The Mantine exporter matched every emitted colour variable against every palette name, so 500 custom roles cost it 1.5 s; it now looks each name up. A 10,000-token design system with four mode combinations now compiles every target in under a second on a laptop.
