---
title: 'Apache ECharts exporter'
description: 'Data-viz theming from design tokens: per-mode theme objects with a brand-derived categorical palette.'
order: 9
---

# Apache ECharts exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/echarts/">Acme</a> · <a href="/demo/cathode/echarts/">Cathode</a> · <a href="/demo/govuk/echarts/">GOV.UK</a> · <a href="/demo/carbon/echarts/">Carbon</a> — one page, four design systems, compiled to Apache ECharts. <a href="/demo/">All 40 demos →</a></p>
</div>

The second reference exporter, and proof that Transtyle is not a CSS generator: the output is a **JSON theme object** for `echarts.registerTheme()`, colors are hex (canvas rendering), and the star of the show is a derivation problem no UI-framework target has — the **categorical data palette**.

<!-- measured: acme.echarts.rows = 17 -->

It is also the smallest surface any target exposes — 17 classified theme keys on [Acme](/docs/examples/) — which is why the palette is the whole story here.

## The palette problem

ECharts' most important themable value is `color: [...]` — series colors that must be _mutually distinguishable_, not just on-brand. Design systems define roles, not ten distinct hues. Transtyle derives an **8-color palette** from your brand: hues rotated in OKLCH around your primary's anchor, lightness and chroma held in bands tuned for adjacent distinguishability, re-tuned per mode for dark surfaces.

The same palette feeds shadcn's `--chart-1…5` (the first five colors, frozen by contract) — one brand, one data-viz palette, everywhere. This is the single-source-of-truth promise applied exactly where hand-maintained themes always drift. Authored palettes win as always: author `semantic.palette.categorical.*` tokens to pin your own.

Pin your own and the compiler checks them: two entries closer than ΔE<sub>OK</sub> 0.05 in a mode raise [`TST2102`](/docs/diagnostics/), because series that close can't be told apart on a chart. The derived palette never does (its closest pair is 0.082).

## Artifacts

One theme per `color-scheme` mode — ECharts has no runtime mode concept, so theme-per-init is the native pattern:

| File                                                       | Purpose                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `theme.<project>-light.json` / `theme.<project>-dark.json` | Theme objects for `registerTheme`                                   |
| `theme.<project>-<mode>.js`                                | Self-registering script-tag variant (also exports the theme in CJS) |
| `usage.md`                                                 | Registration snippets, mode-switching pattern, coverage summary     |
| `report.json`                                              | Coverage + provenance, as always                                    |

## What maps where

| Theme path                                   | Comes from                                 | Note                                                                    |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `color[0]` … `color[7]`                      | `palette.categorical.1–8`, one each        | derived from `primary` (or authored)                                    |
| `backgroundColor`                            | `background.base`                          |                                                                         |
| `textStyle.color` / `.fontFamily`            | `text.base`, `font.sans`                   | font list joined to a CSS string                                        |
| `title`, `legend`, `axisLabel`               | `text.base`, `text-muted.base`             |                                                                         |
| axis lines, ticks, split lines               | `border.base`                              | applied to all four axis types                                          |
| `tooltip` background / border / text         | `overlay.base`, `border.base`, `text.base` | overlay = floating surface, as everywhere                               |
| `tooltip.borderRadius`                       | `radius.md`                                | rem → px at `units.remBase` (16 by default) — classified `approximated` |
| series-specific styles (candlestick, gauge…) | —                                          | honestly reported `unsupported`; extend at `init`                       |

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

Mode switching: dispose and re-init with the other theme name (ECharts fixes the theme at init). Both examples ship ECharts targets — [Cathode's](/docs/examples/#cathode--the-hostile-example) dark theme opens with phosphor green on tube-black, which is worth building just to look at.
