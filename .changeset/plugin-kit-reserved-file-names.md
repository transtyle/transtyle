---
'@transtyle/plugin-kit': minor
---

`conformance()` has a new `no-reserved-file-names` check: an exporter file named `report.json` or `transtyle-manifest.json` fails it, since core writes both in every target's output directory after the exporter's files and would silently overwrite it.
