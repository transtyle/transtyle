# Exporter spec: Apache ECharts

**Why it's a reference exporter:** proves the pipeline is not a CSS generator. Output is a JS/JSON theme object, the mapping is dominated by *programmatic* resolution rather than declarative tables, and it introduces a derivation problem no UI-framework target has: **categorical data palettes**.

## Compatibility

`"targets": { "echarts": [">=5 <7"] }` — the theme object shape has been stable across 5.x; verify 6.x status at implementation time. Profiles per major.

## Emitted artifacts

| File | Purpose |
|---|---|
| `theme.<name>.json` | Theme object for `echarts.registerTheme(name, theme)` — one per color-scheme mode (`theme.acme-light.json`, `theme.acme-dark.json`) |
| `theme.<name>.js` | Same, wrapped as ESM/UMD register module for script-tag users |
| `usage.md` | Registration snippet, mode-switching pattern, coverage summary |

Per-mode theme files (not one theme with embedded modes) because ECharts has no runtime mode concept — theme choice at `init` is the native pattern; the mode dimension is thus `native` via file multiplication.

## The categorical palette problem

ECharts' most important themable value is `color: [...]` — a list of series colors that must be *mutually distinguishable*, not just on-brand. A design system defines roles, not a 10-color categorical set, so this is a first-class derivation rule (`categorical-palette@standard@1`), not exporter ad-hockery:

- inputs: `primary`, `accent`, `secondary` + option-palette hues if present;
- generates N (default 10) colors by distributing hues in OKLCH around the brand anchors, holding lightness/chroma in bands tuned for adjacent-distinguishability on both light and dark surfaces;
- deterministic, explainable (`transtyle explain` shows anchors and generated hue positions), overridable (`derivation.overrides` may pin an authored palette list — authored always wins);
- classified `derived` in coverage; a diagnostic warns when two generated colors fall below a perceptual-distance threshold (e.g. brand constraints force near-collisions).

The same rule feeds shadcn's `--chart-*` variables — one brand, one data-viz palette everywhere. This cross-target consistency is exactly the single-source-of-truth promise, applied where hand-maintained themes always drift.

## Mapping strategy (highlights)

- `background/surface` → `backgroundColor`, tooltip/title/legend backgrounds: `native`.
- `text`/`text-muted` + typography roles → global `textStyle`, `axisLabel`, `legend.textStyle` (family, size in px — `rem` converted via config base, `approximated`): `native`/`approximated`.
- `border`, `neutral` scale → axis lines, split lines, tooltip borders: `native`.
- `success/warning/danger` → visualMap and markLine/markPoint defaults where charts encode status: `native`.
- Motion tokens → `animationDuration`, `animationEasing` (nearest named easing; cubic-bezier flattening: `approximated`).
- Radius → tooltip/dataZoom corner radii: `native`; shadows → `native` (px conversion).
- `unsupported` reported honestly: series-type-specific styling (candlestick up/down colors, gauge bands…) beyond catalog semantics — left at theme defaults and listed, giving users a precise TODO list for manual theme extension (emitted theme includes an `// extend here` merge pattern in `usage.md`).

## Ground-truth testing

Headless (node-canvas or Puppeteer) render of a fixture dashboard (line/bar/pie + axes + tooltip) per theme; pixel-samples assert background/text/palette colors; perceptual-distance property test on generated palettes across a corpus of random brand colors.
