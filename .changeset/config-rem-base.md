---
'@transtyle/core': minor
'@transtyle/exporter-echarts': minor
'@transtyle/exporter-storybook': minor
'@transtyle/plugin-kit': patch
---

Add a config-level `rem` base: `"units": { "remBase": "10px" }` (default `"16px"`, so existing output does not change). Exporters that convert `rem` to pixels read it through the new `ctx.units` (`toPx`, `toRem`, `remBase`): ECharts used a fixed 16 and its `approximated` note now names the configured base; Storybook uses it unless its own `options.remBase` is set. A base that is not a positive `px` length is a `TST1010` error.
