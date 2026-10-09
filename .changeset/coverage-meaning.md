---
'@transtyle/core': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-echarts': minor
'@transtyle/exporter-primeng': patch
---

Coverage rows can say what an `unsupported` slot is missing: `report.json` rows accept an optional `meaning` key (`"icon.size"`, `"icon.asset"`), shared across exporters so the same missing concept can be counted wherever it shows up. Bootstrap's 56 `unsupported` rows and ECharts' one now carry it.

PrimeNG's coverage no longer counts its own primary ramp as left on Aura's default: the eleven `primary.*` steps it emits are reported as driven (Acme: 89 driven, 1104 on Aura's default, was 78 and 1115).
