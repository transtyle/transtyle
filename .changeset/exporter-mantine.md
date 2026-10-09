---
'@transtyle/exporter-mantine': minor
'@transtyle/cli': minor
---

New target: Mantine 9, as `@transtyle/exporter-mantine`, built in by the CLI (`transtyle add mantine`).

It writes `theme.transtyle.ts` with two exports for `<MantineProvider>`: `theme`, a `createTheme()` object, and `cssVariablesResolver`. Every colour role becomes a Mantine virtual colour over a light and a dark ten-step tuple, so `color="danger"` follows the design system in both schemes, and `autoContrast` takes filled text from the role's `on-solid`. The resolver sets Mantine's per-colour variant variables (`--mantine-color-<role>-filled`, `-light`, `-outline`, …) and the page colours per scheme, straight from the compiled grid. There is no override stylesheet: Mantine writes its variables at runtime, after anything in `<head>`, and only the resolver wins that cascade. Type scale, radius, spacing, shadows, breakpoints and the button and input geometry map onto the theme as well; `usage.md` shows the wiring and `report.json` classifies every mapping, including what Mantine has no slot for (the focus ring, the z-index ladder).
