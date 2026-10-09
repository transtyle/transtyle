---
'@transtyle/exporter-mui': minor
'@transtyle/cli': minor
---

New target: Material UI v9, as `@transtyle/exporter-mui`, built in by the CLI (`transtyle add mui`).

It writes `theme.transtyle.ts` with two exports: `themeOptions`, a plain `ThemeOptions` object in CSS-variables mode, and `theme`, the `createTheme(themeOptions)` to pass to `<ThemeProvider>`. Every colour role becomes a palette key in both colour schemes (`danger` is MUI's `error`; `accent`, `neutral` and custom roles are extra keys the module declares for TypeScript), so `<Button color="accent">` type-checks and follows `useColorScheme()`. Text and outlined buttons wear the role's text and outline cells, the Alert severities read their roles, Paper overlays and shadows follow the elevation ladder per scheme, the design system's ring turns on MUI's keyboard focus ring, and the dialog backdrop takes the scrim. Fonts, type roles, radii, spacing, breakpoints, motion and z-index map onto the theme too, and Button, OutlinedInput and Tooltip take the component tier when the design system authors it. Colours are written as hex, since `createTheme` refuses `oklch()`. `report.json` classifies every mapping, including what MUI has no slot for.
