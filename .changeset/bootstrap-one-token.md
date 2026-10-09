---
'@transtyle/exporter-bootstrap': patch
---

Build a design system that authors only `semantic.color.primary.solid` instead of throwing `Cannot read properties of undefined (reading 'c')`.

With no `text.base`, the engine leaves the text colors and `neutral.text-strong` empty (and never derives `border`), and the Bootstrap exporter crashed on the `$dark` pseudo-role. Those variables are now left out, so Bootstrap's own defaults stand, and each one is a `dropped` row in `report.json` under its own name. A line of `bootstrap-theme.css` that holds several declarations loses only the absent ones. A `$theme-colors-*` map entry with no value keeps Bootstrap's own variable (`"dark": $dark-text-emphasis`) rather than printing `undefined`, and is reported as `$theme-colors-text.dark`. Output for design systems that author a text color is unchanged.
