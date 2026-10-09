---
'@transtyle/core': patch
'@transtyle/cli': patch
---

Round contrast ratios down in `TST2101` and in `transtyle diff`'s contrast lines, so a pair just under its threshold no longer prints as the threshold itself.

A ratio of 4.47 against a 4.5 minimum used to read `4.5:1 (< 4.5:1)`; it now reads `4.4:1 (< 4.5:1)`, the same direction `transtyle init`'s closing swatch already rounds.
