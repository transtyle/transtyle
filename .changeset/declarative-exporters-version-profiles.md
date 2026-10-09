---
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/plugin-kit': minor
'@transtyle/exporter-shadcn': minor
'@transtyle/exporter-css-variables': patch
---

A JSON mapping table can now be an exporter, and a target can name the framework version it is built for.

**Declarative exporters.** Point a target at a mapping file next to the config (`"exporter": "./ourlib.mapping.json"`): rows of `{ variable, slot, part?, format?, class?, note? }` in CSS custom properties, Sass, Less or JSON files, with selector blocks per mode value. Core runs it like any exporter and derives the coverage report from the rows; no code runs. A package can ship a mapping instead of code (`"transtyle": { "declarative": "mapping.json", … }`): the CLI reads it and never imports the package. A malformed mapping is `TST1014`, a row naming an unknown slot `TST1015`; the format is published as `schemas/mapping/v0.json`. `@transtyle/core` exports `createDeclarativeExporter`, `validateMapping`, `loadDeclarativePackage` and friends, so `conformance(createDeclarativeExporter(mapping))` tests a mapping like any plugin.

**Version profiles.** `targets.<t>.version: "5.3.8"` selects the exporter manifest range that covers it; the exporter gets `ctx.targetVersion` and `ctx.targetProfile`, and `report.json` records `version: { requested, profile }`. A version outside every range is `TST1313`. shadcn's manifest now declares Tailwind ranges (`>=3 <4`, `>=4 <5`) instead of era names, so `"version": "3.4.17"` selects the tailwind-v3 output; `options.era` still wins when set, with a `TST2105` warning if the two disagree. plugin-kit's new `manifest-targets-ranges` check rejects a `targets` entry that isn't a version range. Without `version`, output is unchanged.

**css-variables** now writes `palette.categorical.*` in its dark block too; its dark values were missing.
