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

Give every package a README, and point `homepage` at its documentation page.

All twelve packages shipped `0.1.0-alpha.0` and `.1` with no README, so each rendered as a blank page on npmjs.com — the surface most people meet the project on, and the only one nobody working in the repo ever reopens. Each now says what it emits, how to use it, and that it is an experimental alpha, and links into the documentation site rather than at the monorepo root.

`@transtyle/exporter-primeng`'s description also claimed it was "not yet registered in the CLI". It has been since C6; the sentence was published to npm twice after it stopped being true.

`check:manifests` grew two checks for the class: a package must have a README that is more than a stub, and a `homepage` naming a docs page must name one that exists — a 404 baked into published metadata cannot be fixed without another release.
