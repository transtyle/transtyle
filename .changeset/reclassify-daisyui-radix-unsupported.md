---
'@transtyle/exporter-daisyui': patch
'@transtyle/exporter-radix': patch
---

The daisyUI `--depth / --noise / --size-*` coverage row and the Radix `(P3/wide-gamut variants)` row are now `unsupported` instead of `dropped`, each with a meaning key (`style.effect`, `color.wide-gamut`), so they count as catalog-growth evidence in the catalog-signals report.
