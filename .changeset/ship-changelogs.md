---
'@transtyle/cli': patch
'@transtyle/core': patch
'@transtyle/ir': patch
'@transtyle/plugin-kit': patch
'@transtyle/exporter-bootstrap': patch
'@transtyle/exporter-css-variables': patch
'@transtyle/exporter-daisyui': patch
'@transtyle/exporter-echarts': patch
'@transtyle/exporter-primeng': patch
'@transtyle/exporter-radix': patch
'@transtyle/exporter-shadcn': patch
'@transtyle/exporter-storybook': patch
---

Ship `CHANGELOG.md` in every published package.

npm always includes `README` and `LICENSE` regardless of the `files` allowlist, but not the changelog — so the first three alphas published with no version history at all, on the one page a stranger reads to decide whether upgrading is safe. Changesets has been writing the file since `0.1.0-alpha.0`; only the allowlist was keeping it in the repo.

`check:manifests` now requires it, so a package added later cannot quietly ship without one.
