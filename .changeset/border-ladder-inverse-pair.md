---
'@transtyle/ir': minor
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/plugin-kit': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-chakra': minor
'@transtyle/exporter-daisyui': minor
'@transtyle/exporter-echarts': minor
'@transtyle/exporter-mantine': minor
'@transtyle/exporter-mui': minor
'@transtyle/exporter-primeng': minor
'@transtyle/exporter-shadcn': minor
'@transtyle/exporter-storybook': minor
---

Breaking (alpha): `semantic.color.border` is now a ladder, `semantic.color.border.{subtle, base, strong, field}`, and the catalog gains an inverse pair, `semantic.color.inverse.{surface, text}` (proposal 0005).

Move your border token from `semantic.color.border` to `semantic.color.border.base`: a token left at the old path is now an error (`TST1122`) that names the new one, and the css-variables exporter writes `--color-border-base` instead of `--color-border`. `border.base` derives from `text.base` when you don't author it, so a minimal design system now has a border; `border.subtle` and `border.strong` (the smallest step toward the text that reaches 3:1) derive from it, and `border.field`, the form-field border at rest, aliases it. `inverse.surface` / `inverse.text` default to `neutral.text-strong` / `elevation.0.surface` and are contrast-checked as a pair.

Exporters read the new slots where the target has a matching variable: shadcn's `--input` and Storybook's `inputBorder` read `border.field`; PrimeNG's field, card and overlay borders now follow your border instead of the neutral outline, its field, list and menu icons follow the text ladder, its `contrast` severity reads the inverse pair, and its tooltip does too when you author the pair; Bootstrap's tooltip follows an authored pair in both modes, and its close button and select chevron take `text.base` instead of staying `#000` and `#343a40`; Chakra's `bg.inverted`, `fg.inverted` and `border.subtle` read the new slots. Unauthored, Bootstrap, shadcn, daisyUI, ECharts, Radix, Storybook, Mantine and MUI colours are unchanged apart from those two Bootstrap glyphs.

A token that has both a `$value` and child tokens is now an error (`TST1311`), as DTCG requires; its children used to be dropped silently.

`transtyle bind --suggest` proposes `border.base` and the inverse pair, and its name table is now `synonyms@2`: a text or surface name with an inverse word (`text-inverse`, `background-inverse`) reads as `inverse.text` / `inverse.surface`, never as `text.inverse`.
