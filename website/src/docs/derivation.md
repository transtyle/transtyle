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

## The standard@1 rule pack (implemented subset)

| Slot filled | Rule |
|---|---|
| `accent.base` | alias of `primary` |
| `secondary.base` | desaturated primary (chroma × 0.35, lightness toward mid) |
| `danger.base` | fixed red hue (25), chroma/lightness matched to your brand |
| `success.base` / `warning.base` / `info.base` | fixed hue anchors (150 / 85 / 230) — hue is conventional, temperature follows the brand |
| `neutral.base` | neutral gray carrying your brand's hue cast |
| `<role>.hover` / `<role>.active` | lightness deltas from base; **direction flips in dark mode** (darken on light, lighten on dark) |
| `<role>.subtle` | base mixed 92% toward `surface` — the tinted-background family (shadcn's muted/secondary/accent surfaces) |
| `text-on-<role>.base` | contrast-pick white vs. near-black against the role base; **hard rule: below 4.5:1 emits a warning, never silence** |
| `text-on-<role>.subtle` | prefers an on-brand foreground (the role's active shade) when it clears AA; falls back to your text color |
| `surface-raised` / `overlay` | surface raised toward white (light) or lightened (dark); overlay = floating layers |
| `scrim` | near-black veil at fixed alpha |
| `ring.base` | primary, lightened in dark mode for visibility |
| `palette.categorical.1–5` | data-viz palette: hues rotated from your brand anchor, lightness/chroma banded for adjacent distinguishability; feeds shadcn's `--chart-*` |

Approximate OKLCH values in this table are produced by real color math in `packages/core/src/color.js` — including proper OKLab↔sRGB conversion and WCAG 2.1 contrast ratios.

## Provenance classes

`derived` values track your brand: change `primary` and every derived value follows (hover tints, on-colors, the whole chart palette — see it live by editing the Acme example and rebuilding). `defaulted` values are catalog constants with no user input. The distinction matters for audits: the report can tell you "your theme is 43% authored, 54% derived, 3% approximated".

## What derivation refuses to do

- **Invent your dark theme** (unless you opt in with `autoDark: true`, and even then everything is flagged `derived`). Dark brand adjustment is a design decision; the engine won't take it from you silently.
- **Have taste.** Derivation guarantees *coherence*, not *art direction*. On the [Cathode terminal theme](/docs/examples/#cathode-the-hostile-example), derived `info` comes out conventionally blue — coherent, aesthetically wrong for a monochrome CRT, and fixed by one authored line. That boundary is by design.
- **Run your code.** Rules are declarative and shipped in versioned packs; there is deliberately no JS escape hatch in token processing. If the rule language is insufficient, that's a spec conversation, not a plugin.

## Practical workflow

1. Author the minimum you have opinions about (brand color, neutrals, dark neutrals, radius, fonts).
2. Build; read `report.json` and the `· derived` comments in the output.
3. Where a derived value is wrong for you, author that token. Repeat. Your token file grows exactly as fast as your opinions do.
