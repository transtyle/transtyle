---
'@transtyle/cli': minor
---

`transtyle check --matrix` lists, for every catalog slot, the targets that read it, so you can see which libraries change before you author a slot. The CLI records the slots each exporter reads while it emits (third-party exporters included, no change needed on their side) and classes each reader from its coverage rows (`native`, `derived`, `approximated`, or `input` when the slot only feeds another value). With `--json`, the check report gains a `matrix` key with the same data.
