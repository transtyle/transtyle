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

Make the packages findable on npm.

All twelve alphas published with no `keywords`, which on npm is the same defect as the blank README the previous alpha fixed: search ranks on name, description and keywords, so a package with none is reachable only by someone who already knows what it is called — and the people it most needs to reach are precisely the ones who don't. Someone looking for "design tokens bootstrap theme" found nothing.

Every package now carries the two shared anchors (`design-tokens`, `design-system`) plus its own terms — the exporters name their target and that ecosystem's vocabulary, so `exporter-primeng` answers a PrimeNG search and `exporter-radix` a Radix Colors one. `check:manifests` was extended to enforce all of it: the field must exist, carry both anchors, and hold lowercase space-free tokens with no duplicates. Verified by breaking each of the four rules in turn and watching the message name the real problem.
