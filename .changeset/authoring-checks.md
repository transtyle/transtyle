---
'@transtyle/core': minor
---

Two new authoring checks. `TST1120` (info) names an authored colour that a slot reaches and that lies outside sRGB, with the hex every target that writes hex or HSL ships instead (Bootstrap and Storybook clamp it without saying so anywhere else). `TST1121` (warning) flags a partially authored `space`, `type.size`, `size.control`, `border-width`, `breakpoint` or `duration` scale that ships out of order: a catalog default out of order with an authored rung (an 8px `space.1`–`space.4` next to the 4px defaults), or a scale authored only under its own names (`space.sm`/`md`/`lg`), which no target reads. Tuning one rung in order stays silent.

Exporters can now return `diagnostics: [{ severity, code, message, hint? }]` from `emit()` next to `files` and `coverage`. Core accepts `info` and `warning`, prefixes each message with the target instance name and sets `target`; a malformed entry is reported as `TST3001`. `checkExporterDiagnostics` is exported for tools that validate the same shape.
