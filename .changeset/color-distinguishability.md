---
'@transtyle/core': minor
---

New warnings `TST2102` and `TST2103` flag colors that can't be told apart.

`TST2102` fires when two entries of `palette.categorical.1-8` are closer than 0.05 in OKLab (ΔE<sub>OK</sub>) in a mode, `TST2103` when the `solid` colors of `success`, `warning`, `danger`, `info` or a role archetyped `status` are that close or identical, the shape of a design system whose four alert colors all resolve to one value in dark mode. Colors under the threshold are grouped, so four identical roles give one warning that names all four. Two roles bound to the very same token are skipped, since that is deliberate. The derived palette and status roles never trigger them; they guard authored values. Both are warnings, so `check.failOn` decides whether they fail a build.
