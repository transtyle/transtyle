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

Put the project's logo on every package page.

Each README now opens with the Transtyle mark, linked to the documentation site. It is referenced by absolute URL and in the on-dark variant on purpose: npm renders package pages outside the repository, so a relative path 404s there, and it renders them on both a light and a dark background from a single `<img>` with no way to swap per theme — the on-dark variant is the one that reads on both.

The mark itself is generated rather than maintained: one description in `scripts/gen-brand.mjs` renders both SVG variants, their PNG rasters, and the site's favicon and app icons, and a new `check:brand` guard fails on a stale asset or on a surface that has quietly stopped carrying it — including these twelve pages.
