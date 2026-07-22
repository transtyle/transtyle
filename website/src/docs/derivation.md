---
title: "Derivation engine"
description: "The rules that fill what you did not author, and the promises they keep."
order: 6
---

# Derivation engine

Derivation fills every semantic slot you didn't author. It's the reason 11 tokens can produce a complete 33-variable theme — and it's built on three promises, because a tool that silently invents brand values deserves rejection:

1. **Deterministic.** Pure functions over OKLCH color math. Same inputs, same outputs, forever, on every machine. No ML, nothing environment-dependent.
2. **Explainable.** Every derived value records the rule that made it and the inputs it used — visible in `report.json` and in the generated CSS comments (`· derived`).
3. **Governable.** Authored values always win. `derivation.require` lets you forbid derivation for specific tokens. Rule packs are version-pinned in config.

## Rules only fill holes

The engine walks the semantic catalog; any slot with an authored or aliased value is untouched. Overriding a derived value = authoring that token. One line, visible in your token files, versioned with your design system.

## The standard@1 rule pack: the role grid

Every color role fills a **grid** — prominence × interaction state — not a flat list; see [the language reference](/docs/language/#color-roles-the-role-grid) for the full shape and why.

| Slot filled | Rule |
|---|---|
| `accent.solid` | alias of `primary.solid` |
| `secondary.solid` | desaturated primary (chroma × 0.35, lightness toward mid) |
| `danger.solid` | fixed red hue (25), chroma/lightness matched to your brand |
| `success.solid` / `warning.solid` / `info.solid` | fixed hue anchors (150 / 85 / 230) — hue is conventional, temperature follows the brand |
| `neutral.solid` | neutral gray carrying your brand's hue cast |
| `<role>.solid-hover` / `<role>.solid-active` | lightness deltas from `solid`; **direction flips in dark mode** (darken on light, lighten on dark) |
| `<role>.tint` / `-hover` / `-active` | `solid` mixed 92%/88%/84% toward `elevation.1.surface` in cartesian OKLab — the tinted-background family (shadcn's muted/secondary/accent surfaces); hue follows the surface as chroma collapses, so heavy tints sit ambiently instead of glowing |
| `<role>.outline` / `-hover` | `solid` mixed 70%/55% toward `elevation.1.surface` — the border-subtle family (was a private Bootstrap-only formula; now a first-class grid cell) |
| `<role>.text-strong` | the role re-anchored at your text lightness — its hue/chroma pushed to text-level contrast (Bootstrap's `$dark`/`$light`, emphasis text) |
| `<role>.on-solid` | contrast-pick white vs. near-black against `solid`; **hard rule: below 4.5:1 emits a warning, never silence** |
| `<role>.on-tint` | on-brand walk: starts at `solid-active` and steps lightness away from `tint` until AA clears; falls back to the max-contrast neutral only if the ramp runs out |
| `<role>.text` / `-hover` / `-active` | the same on-brand walk against `elevation.0.surface` (the page) — a role-colored, AA-safe text/link color |
| `elevation.1..5.surface` | each level raised from the one below: toward white in light mode, lightened in dark mode |
| `elevation.1..4.shadow` | composed from `scrim` at fixed geometry/alpha ramps, one per level |
| `text.muted` / `text.subtle` / `text.disabled` | `text.base` mixed toward `elevation.1.surface`, or given reduced alpha |
| `text.strong` | alias of `neutral.text-strong` — the neutral role's own grid, reused for content emphasis |
| `text.inverse` | `text.base` of the *other* color-scheme mode — the one legitimate cross-mode read |
| `link.base` / `-hover` / `-visited` | `primary.text` and its state cells, hue-shifted for visited |
| `scrim` | near-black veil at fixed alpha |
| `ring` | primary, lightened in dark mode for visibility |
| `space.*`, `size.control.*`, `border-width.*`, `breakpoint.*`, `z.*`, `type.*`, `duration.*`, `easing.*` | catalog-default constants (`defaulted`) unless you author them — the same values every exporter that needs a spacing/type/motion scale now shares |
| `palette.categorical.1–8` | data-viz palette: hues rotated from your brand anchor, lightness/chroma banded for adjacent distinguishability; feeds shadcn's `--chart-1…5` (first five, frozen) and [ECharts' `color[]`](/docs/exporter-echarts/) (all eight) |

Approximate OKLCH values in this table are produced by real color math in `packages/core/src/color.js` — including proper OKLab↔sRGB conversion and WCAG 2.1 contrast ratios.

## Provenance classes

`derived` values track your brand: change `primary` and every derived value follows (hover tints, on-colors, the whole chart palette — see it live by editing the Acme example and rebuilding). `defaulted` values are catalog constants with no user input. The distinction matters for audits: the report can tell you "your theme is 43% authored, 54% derived, 3% approximated".

## What derivation refuses to do

- **Invent your dark theme** (unless you opt in with `autoDark: true`, and even then everything is flagged `derived`). Dark brand adjustment is a design decision; the engine won't take it from you silently.
- **Have taste.** Derivation guarantees *coherence*, not *art direction*. On the [Cathode terminal theme](/docs/examples/#cathode--the-hostile-example), derived `info` comes out conventionally blue — coherent, aesthetically wrong for a monochrome CRT, and fixed by one authored line. That boundary is by design.
- **Run your code.** Rules are declarative and shipped in versioned packs; there is deliberately no JS escape hatch in token processing. If the rule language is insufficient, that's a spec conversation, not a plugin.

## Practical workflow

1. Author the minimum you have opinions about (brand color, neutrals, dark neutrals, radius, fonts).
2. Build; read `report.json` and the `· derived` comments in the output.
3. Where a derived value is wrong for you, author that token. Repeat. Your token file grows exactly as fast as your opinions do.
