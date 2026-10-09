---
'@transtyle/exporter-mantine': minor
---

The Mantine report now measures the theme against Mantine's whole theming surface.

The package ships `surface-inventory.json`, extracted from `@mantine/core` 9.7.1: every key of Mantine's default theme and every CSS variable its default resolver writes (203 entries, Mantine's default palettes folded into one). `report.json` gains one row per part of that surface (the theme object, and the resolver's `variables`, `light` and `dark` blocks) saying how many entries the emitted theme sets, how many Mantine computes from it, and how many keep Mantine's value, plus one row per entry kept, with the reason (a behaviour switch such as `focusRing`, the gradient variant, the unread z-index variables, or, for a design system without a dark scheme, the dark block). The emitted `theme.transtyle.ts` is unchanged.
