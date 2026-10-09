---
'@transtyle/core': minor
'@transtyle/cli': minor
---

`transtyle build` now writes a `transtyle-manifest.json` in each target's output directory, and `build` and `check` warn when a generated file was edited or removed by hand.

The manifest records a sha256 of every file the exporter produced (line endings normalized, keys sorted, no timestamp) and is swapped in atomically with those files. Before writing anything, `build` and `check` compare it with the disk and raise the new `TST1312` (warning) for each file that changed or is gone, and for a manifest that can't be read. `build` warns, then overwrites. No manifest means no warning, so existing output is not reported until it has been rebuilt once. `check.failOn: "warning"` turns it into a failure and `check.suppress` can silence it. The drift check is a new `compile({ drift: true })` option, off by default for API callers.

A build also lists, once, the files a previous build wrote that it no longer produces (`· stale: …`), and leaves them in place. The manifest's JSON schema is published at `https://transtyle.dev/schemas/manifest/v0.json`.
