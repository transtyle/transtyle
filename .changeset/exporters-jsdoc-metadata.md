---
'@transtyle/ir': minor
'@transtyle/exporter-chakra': minor
'@transtyle/exporter-mantine': minor
'@transtyle/exporter-primeng': minor
'@transtyle/exporter-mui': minor
'@transtyle/exporter-storybook': minor
'@transtyle/exporter-echarts': minor
'@transtyle/exporter-radix': minor
---

The TypeScript targets write a slot's `$description` and `$deprecated` as JSDoc.

Chakra, Mantine, PrimeNG, MUI and Storybook put a `/** … */` block above each property that maps exactly one slot, and ECharts does the same in its `.js` theme (the `.json` twin takes no comments). The description shows on hover in an editor, and `@deprecated <reason>` strikes the property through. Radix writes the same text as a `/* … */` comment above each variable that is exactly one grid cell. A property computed from several slots, or from a derived one, gets no comment, and a `*/` in a description is broken up so the file still parses. `@transtyle/ir` exports `jsdocComment()`, `Documented`, `withDoc()` and `withoutDocs()` for exporters that print an object tree.
