---
'@transtyle/exporter-chakra': minor
'@transtyle/cli': minor
---

New target: Chakra UI v3, as `@transtyle/exporter-chakra`, built in by the CLI (`transtyle add chakra`).

It writes `theme.transtyle.ts` with two exports: `config`, a `defineConfig()` object, and `system`, the `createSystem(defaultConfig, config)` to pass to `<ChakraProvider value={system}>`. Every colour role becomes a Chakra palette with its eight semantic keys (`solid`, `contrast`, `fg`, `subtle`, `muted`, `emphasized`, `border`, `focusRing`), each with a `_light` and a `_dark` value, so `colorPalette="danger"` follows the design system in both schemes and a `.dark` class on `<html>` switches them all. Chakra's default palette becomes the `neutral` role and the Alert's statuses read `info`, `warning`, `success` and `danger`; Chakra's own hue palettes are left alone. The page colours, fonts, type scale and text styles, radii, spacing, shadows, motion, z-index, breakpoints and control heights map onto the theme as well, and the button, input and tooltip recipes take the component tier when the design system authors it. `report.json` classifies every mapping, including what Chakra derives itself (hover and active colours) and has no slot for.
