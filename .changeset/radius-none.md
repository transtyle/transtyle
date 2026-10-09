---
'@transtyle/core': patch
---

`semantic.radius.none` is now derived, as the IR catalog always specified.

The F8 radius ramp filled `sm`, `lg`, `xl` and `full` from an authored `semantic.radius.md` but never `none`, so a design system that didn't author it had no zero step and css-variables emitted no `--radius-none`. DERIVE now fills it with `0` in `radius.md`'s unit (`0rem` for `0.5rem`, `0px` for `6px`). An authored `radius.none` still wins, and a design system without `radius.md` derives no radius at all, as before.
