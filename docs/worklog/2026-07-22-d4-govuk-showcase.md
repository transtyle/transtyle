# Worklog — D4: the "GOV.UK, end to end" showcase

**Task:** D4 (docs/plan/execution-2026-h2.md). New `website/src/docs/govuk-showcase.md` in the Guides nav section (after examples), cross-linked from the overview.

**Discipline: show, don't narrate — and every value is real.** Before writing a line I ran the GOV.UK build and harvested genuine data, so nothing on the page is invented:

- Source swatches: GOV.UK's real functional/web-palette hex (brand #1d70b8, error #ca3535, success #0f7a52, focus #ffdd00, purple #54319f, black tint-50 #858686).
- "One value, every dialect" table: the brand blue as actually emitted (`$primary: #1d70b8` in Bootstrap sRGB; `oklch(0.535 0.136 249.9)` in shadcn/css-vars) — copied from the built `dist/`.
- Judgment-call cards: the six real calls, with the derived values from live `transtyle explain` (warning→#daa932 hue-anchor 85, secondary→#657d96 desaturate, accent→#1d70b8 alias).
- Coverage matrix: the eight targets' actual native/derived/approximated/other split from each `report.json` (css-variables 100% native … bootstrap 23/66/2/…).
- Honesty-notes table: verbatim `note` fields (Bootstrap inset-shadow unsupported, motion dropped, Radix alpha-ramp approximated, ECharts candlestick unsupported, PrimeNG structural components unsupported).

**New theme-aware components (global.css):** `.covmatrix` (per-target stacked coverage bars driven by inline widths, using the site-wide native/derived/approx palette + a grey "other" for dropped+unsupported) and `.jcalls` (judgment-call cards, left-border colour-coded clean/chose/derived).

**One correction during verification:** two bars (daisyui, bootstrap) summed to 101% — the CLI's own rounded percentages carry 1% rounding slack. Trimmed the dominant `derived` segment by 1% in each so the _visual_ bar is exactly 100; the prose keeps the exact reported figures. All eight bars now sum to 100.

**Verified in preview (light + dark):** swatches/jcalls/matrix render, all bars sum to 100, tokens resolve in both themes, zero console errors; site build (27 pages) + check:docs + check:sync + check:all all green.
