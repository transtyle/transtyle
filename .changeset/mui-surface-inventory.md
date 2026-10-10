---
'@transtyle/exporter-mui': minor
---

The Material UI report now measures the theme against MUI's whole theming surface.

The package ships `surface-inventory.json`, extracted from `@mui/material` 9.5.0 by calling `createTheme()` in CSS-variables mode with both colour schemes: every CSS variable its style sheets write, per block, and every theme leaf no variable carries (the typography variants, transitions, breakpoints, the opt-in focus ring, `motion.reducedMotion`, the palette's `tonalOffset` and `contrastThreshold`), 491 entries. Each per-component palette token records whether MUI points it at another palette variable or writes its value out. `report.json` gains one row per part of that surface (the theme leaves, and the `:root`, `light` and `dark` blocks) saying how many entries the emitted theme sets, how many MUI computes from it, and how many keep MUI's value, plus one row per entry kept, with the reason (the grey ramp and what reads it, the state veils, the uppercase button, the letter spacing a design system's type roles leave out, or, for a design system without a dark scheme, the dark block). These rows replace the single `colorSchemes.*.opacity.*` row. The emitted `theme.transtyle.ts` is unchanged.
