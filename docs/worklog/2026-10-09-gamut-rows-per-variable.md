# Gamut clamps reach the coverage report, per variable

Issue #171. Every hex writer gets `{ text, clamped }` from `ctx.formatHex()`, but Bootstrap and Storybook kept only `.text`, so a clamped colour never reached `report.json`, and ECharts folded all clamps into one `(gamut)` row naming the last slot.

## The change

- Bootstrap (`packages/exporter-bootstrap`): the coverage helper tests the row's slot in the light and dark maps with `formatHex`; a clamp in either makes the row `approximated` and appends the note `sRGB gamut clamp during oklch → hex`. The `opaque` component recipe (`components.js`) does the same for the colour it writes.
- Storybook: same rule in the ThemeVars `cov()`, across every mode.
- ECharts: `buildTheme` returns the clamped slots, `emit()` unions them across modes and marks the matching rows; the `(gamut)` row is gone (Acme: 18 rows to 17).
- `scripts/check-gamut-rows.mjs` (`check:gamut-rows`, in `check:all`): Acme with an authored `oklch(0.7 0.3 145)` primary must give gamut rows in Bootstrap, Storybook, ECharts, Radix and shadcn-v3, and ECharts no aggregate row.
- Measured figures moved: `acme.bootstrap.derived` 493 to 489 and `approximated` 35 to 39, `acme.echarts.rows` 18 to 17, the GOV.UK ECharts bar; the slot matrix was regenerated.

## Decisions

- Slot-based, not call-based: the row is classed from the slot it names, using the same predicate as `TST1120`, rather than threading a flag through every `hx()` call (Bootstrap calls it over 40 times, many on mixes that have no row of their own).
- A clamp in either mode marks the row, since the report is recorded once.
- Not done: gamut-mapping derived cells at derivation (the issue's open question). It changes derived colours in every example and stays Julien's call.
- `ci.yml` is not touched, so `check:gamut-rows` runs in `check:all` but still needs a CI step.
