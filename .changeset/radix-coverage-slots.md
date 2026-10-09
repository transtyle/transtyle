---
'@transtyle/exporter-radix': patch
---

Name the slots behind each ramp coverage row.

Every `--<role>-<step>` and `--<role>-a<step>` row now carries a `slots` field with the role cells and elevation surfaces its step is computed from (step 6 reads the role's `solid` and `elevation.1.surface`, step 9 reads `solid`, and so on), and the `--gray-*` row lists the neutral cells. The `slot` label (`semantic.color.<role>.*`) is unchanged. `transtyle explain --variable <Radix step variable> --target radix` now prints the role cells and their provenance, and the slot matrix records them as named reads. The emitted CSS is unchanged.
