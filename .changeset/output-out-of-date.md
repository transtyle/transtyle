---
'@transtyle/core': minor
---

`transtyle check` now warns (`TST1315`) when generated files that nobody edited no longer match what the tokens compile to, the "forgot to rebuild" case.

`check` already has every target's fresh files in memory. When a file still matches the hash in its `transtyle-manifest.json` (so `TST1312` is silent) but the fresh compile writes different bytes, `check` raises one warning per target, naming the first files. Files `TST1312` already reported, files the manifest doesn't list, and targets without a usable manifest are left out. `build` doesn't raise it, since it rewrites the files at once. It follows `check.failOn` and `check.suppress` like any warning.
