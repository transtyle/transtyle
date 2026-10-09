---
'@transtyle/core': patch
---

Make EMIT atomic: a failed build no longer leaves a half-written output.

Every exporter now runs before anything is written. The files of all targets are then staged next to their output directories (`<output>.transtyle-tmp/`) and renamed into place, and if any step fails the swap is rolled back, so each output directory is exactly what it was before the build. Previously an exporter that threw on the second target, or an error-level diagnostic raised by it, left the first target's files updated and the rest stale. Files in an output directory that the build did not produce are still never touched. Output bytes are unchanged.
