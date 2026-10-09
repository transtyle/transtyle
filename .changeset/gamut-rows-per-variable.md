---
'@transtyle/exporter-bootstrap': patch
'@transtyle/exporter-storybook': patch
'@transtyle/exporter-echarts': patch
---

Report an oklch colour that was clamped into sRGB as `approximated`, with the note `sRGB gamut clamp during oklch → hex`, on the row of each variable written from it. Bootstrap and Storybook used to drop the clamp; ECharts reported one aggregate `(gamut)` row naming the last clamped slot, and now marks every affected variable (an Acme report has one row fewer).
