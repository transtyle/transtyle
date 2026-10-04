---
'@transtyle/core': patch
---

Stop reporting `TST1204` (dark-mode carry-over) for a role whose `.solid` never resolved.

When `semantic.color.primary.solid` was a dangling alias (`TST1105`), part of an alias cycle (`TST1104`) or an unparseable colour (`TST1106`), the build printed the error and, next to it, an info note saying the light-mode value "carries over unchanged" into dark. There was no light-mode value: the comparison found `undefined` equal to `undefined`. The note is now skipped when the default-mode value is missing, so only the cause is reported, as for `TST1201`. `check:cli` covers all three cases against the `init` scaffold.
