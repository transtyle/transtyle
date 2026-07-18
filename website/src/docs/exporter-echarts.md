---
title: "Apache ECharts exporter"
description: "Data-viz theming from design tokens: per-mode theme objects with a brand-derived categorical palette."
order: 9
---

# Apache ECharts exporter

The second reference exporter, and proof that Transtyle is not a CSS generator: the output is a **JSON theme object** for `echarts.registerTheme()`, colors are hex (canvas rendering), and the star of the show is a derivation problem no UI-framework target has — the **categorical data palette**.

## The palette problem

ECharts' most important themable value is `color: [...]` — series colors that must be *mutually distinguishable*, not just on-brand. Design systems define roles, not ten distinct hues. Transtyle derives an **8-color palette** from your brand: hues rotated in OKLCH around your primary's anchor, lightness and chroma held in bands tuned for adjacent distinguishability, re-tuned per mode for dark surfaces.

The same palette feeds shadcn's `--chart-1…5` (the first five colors, frozen by contract) — one brand, one data-viz palette, everywhere. This is the single-source-of-truth promise applied exactly where hand-maintained themes always drift. Authored palettes win as always: author `semantic.palette.categorical.*` tokens to pin your own.

## Artifacts

One theme per `color-scheme` mode — ECharts has no runtime mode concept, so theme-per-init is the native pattern:

| File | Purpose |
|---|---|
| `theme.<project>-light.json` / `theme.<project>-dark.json` | Theme objects for `registerTheme` |
| `theme.<project>-<mode>.js` | Self-registering script-tag variant (also exports the theme in CJS) |
| `usage.md` | Registration snippets, mode-switching pattern, coverage summary |
| `report.json` | Coverage + provenance, as always |

## What maps where

| Theme path | Comes from | Note |
|---|---|---|
| `color[]` | `palette.categorical.1–8` | derived from `primary` (or authored) |
| `backgroundColor` | `background.base` | |
| `textStyle.color` / `.fontFamily` | `text.base`, `font.sans` | font list joined to a CSS string |
| `title`, `legend`, `axisLabel` | `text.base`, `text-muted.base` | |
| axis lines, ticks, split lines | `border.base` | applied to all four axis types |
| `tooltip` background / border / text | `overlay.base`, `border.base`, `text.base` | overlay = floating surface, as everywhere |
| `tooltip.borderRadius` | `radius.md` | rem → px (base 16) — classified `approximated` |
| series-specific styles (candlestick, gauge…) | — | honestly reported `unsupported`; extend at `init` |

OKLCH → hex may clamp colors outside the sRGB gamut; clamped values are classified `approximated` with a note.

## Usage

```json
"targets": { "echarts": { "output": "dist/echarts" } }
```

```js
import * as echarts from 'echarts';
import light from './theme.acme-design-system-light.json' with { type: 'json' };
echarts.registerTheme('acme-light', light);
const chart = echarts.init(el, 'acme-light');
```

Mode switching: dispose and re-init with the other theme name (ECharts fixes the theme at init). Both examples ship ECharts targets — [Cathode's](/docs/examples/#cathode-the-hostile-example) dark theme opens with phosphor green on tube-black, which is worth building just to look at.
