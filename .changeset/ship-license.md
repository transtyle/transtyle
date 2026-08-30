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

Ship the MIT licence text in every published package.

npm adds a `LICENSE` file to a tarball only when one sits in the package directory. Only the monorepo root had one, so the first three alphas published twelve packages that each declared `"license": "MIT"` without carrying the text those terms ask to be distributed with them.

Each package now holds a copy, and `check:manifests` requires it to be byte-identical to the root one — twelve copies of a licence being exactly the sort of thing that drifts a copyright year with nobody noticing.
