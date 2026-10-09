---
'@transtyle/exporter-chakra': minor
'@transtyle/ir': minor
---

The Chakra UI report now measures the config against Chakra's whole theming surface.

The package ships `surface-inventory.json`, extracted from `@chakra-ui/react` 3.37.0: every token, semantic token, breakpoint, text style and layer style of Chakra's default config, and every recipe and slot-recipe leaf that reads a token (2426 entries, Chakra's hue palettes folded into one). `report.json` gains one row per part of that surface saying how many entries the emitted config sets, how many Chakra derives from it, and how many keep Chakra's value, plus one row per token-level entry kept, with the reason (a hue palette, a rung the catalog's scale does not have, a constant such as `transparent`). Recipe leaves kept on Chakra's default are counted on their family's row: each reads a token that has its own row. The emitted `theme.transtyle.ts` is unchanged.

`@transtyle/ir` exports the helpers both the Mantine and the Chakra exporters measure their inventories with: `surfaceStatus()`, `surfaceRows()`, `surfaceCounts()` and `SURFACE_FAMILY_ROW`.
