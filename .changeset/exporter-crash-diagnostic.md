---
'@transtyle/core': patch
'@transtyle/cli': patch
---

Name the target when an exporter throws, instead of printing only the exception message and exiting 2.

A throw in an exporter's `emit` is now a `TST3001` error (`Exporter "bootstrap" crashed in emit: <message>`), and an exporter that cannot be loaded is `TST3002`. The other targets are still built, the crashed target's `report.json` has no files and carries the diagnostic, and the run exits 1 like any error. `TRANSTYLE_DEBUG=1` prints the stack. `transtyle explain` no longer runs the exporters at all.
