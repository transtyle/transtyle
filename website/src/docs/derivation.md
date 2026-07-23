---
title: 'Derivation engine'
description: 'The rules that fill what you did not author, and the promises they keep.'
order: 6
---

# Derivation engine

Derivation fills every semantic slot you didn't author. Concretely, on the [Acme example](/docs/examples/): **39 authored DTCG tokens produce 270 resolved slots per mode**, which the shadcn exporter alone turns into 103 CSS custom properties. The other 231 slots are the engine's work.

It's built on three promises, because a tool that silently invents brand values deserves rejection:

1. **Deterministic.** Pure functions over OKLCH color math. Same inputs, same outputs, forever, on every machine. No ML, nothing environment-dependent.
2. **Explainable.** Every derived value records the rule that made it and the inputs it used — visible in `report.json` and in the generated CSS comments (`· derived`).
3. **Governable.** Authored values always win. `derivation.require` lets you forbid derivation for specific tokens. Rule packs are version-pinned in config.

## Rules only fill holes

Derivation behaves like **water finding its level**: it fills what you left empty and flows around everything you placed. The engine walks the semantic catalog; any slot with an authored or aliased value is untouched. Overriding a derived value _is_ authoring that token — one line, visible in your token files, versioned with your design system.

### Worked example: one value, traced

`transtyle explain` prints the actual rule and the actual inputs, recursively, for any slot:

```
$ transtyle explain semantic.color.primary.tint --cwd examples/acme

semantic.color.primary.tint = oklch(0.95 0.017 255)  [#e7effa]
 └─ derived by rule mix-toward-surface(0.92)@standard@1
    inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
     └─ aliased → option.color.blue.600
    inputs: semantic.color.elevation.1.surface = oklch(0.985 0.003 255)  [#f9fafc]
     └─ aliased → option.color.gray.50
```

Read bottom-up, that is the whole story of a value nobody wrote: Acme authored a blue and a near-white gray, aliased them to `primary.solid` and `elevation.1.surface`, and the tint is those two mixed 92% toward the surface. Change the blue and this recomputes; author `semantic.color.primary.tint` yourself and the rule stops running for that slot. Nothing else in the chain changes either way.

## The standard@1 rule pack: the role grid

Every color role fills a **grid** — prominence × interaction state — not a flat list; see [the language reference](/docs/language/#color-roles-the-role-grid) for the full shape and why.

| Slot filled                                                                                              | Rule                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent.solid`                                                                                           | alias of `primary.solid`                                                                                                                                                                                                                          |
| `secondary.solid`                                                                                        | desaturated primary (chroma × 0.35, lightness toward mid)                                                                                                                                                                                         |
| `danger.solid`                                                                                           | fixed red hue (25), chroma/lightness matched to your brand                                                                                                                                                                                        |
| `success.solid` / `warning.solid` / `info.solid`                                                         | fixed hue anchors (150 / 85 / 230) — hue is conventional, temperature follows the brand                                                                                                                                                           |
| `neutral.solid`                                                                                          | neutral gray carrying your brand's hue cast                                                                                                                                                                                                       |
| `<role>.solid-hover` / `<role>.solid-active`                                                             | lightness deltas from `solid`; **direction flips in dark mode** (darken on light, lighten on dark)                                                                                                                                                |
| `<role>.tint` / `-hover` / `-active`                                                                     | `solid` mixed 92%/88%/84% toward `elevation.1.surface` in cartesian OKLab — the tinted-background family (shadcn's muted/secondary/accent surfaces); hue follows the surface as chroma collapses, so heavy tints sit ambiently instead of glowing |
| `<role>.outline` / `-hover`                                                                              | `solid` mixed 70%/55% toward `elevation.1.surface` — the border-subtle family (was a private Bootstrap-only formula; now a first-class grid cell)                                                                                                 |
| `<role>.text-strong`                                                                                     | the role re-anchored at your text lightness — its hue/chroma pushed to text-level contrast (Bootstrap's `$dark`/`$light`, emphasis text)                                                                                                          |
| `<role>.on-solid`                                                                                        | contrast-pick white vs. near-black against `solid`; **hard rule: below 4.5:1 emits a warning, never silence**                                                                                                                                     |
| `<role>.on-tint`                                                                                         | on-brand walk: starts at `solid-active` and steps lightness away from `tint` until AA clears; falls back to the max-contrast neutral only if the ramp runs out                                                                                    |
| `<role>.text` / `-hover` / `-active`                                                                     | the same on-brand walk against `elevation.0.surface` (the page) — a role-colored, AA-safe text/link color                                                                                                                                         |
| `elevation.1..5.surface`                                                                                 | each level raised from the one below: toward white in light mode, lightened in dark mode                                                                                                                                                          |
| `elevation.1..4.shadow`                                                                                  | composed from `scrim` at fixed geometry/alpha ramps, one per level                                                                                                                                                                                |
| `text.muted` / `text.subtle` / `text.disabled`                                                           | `text.base` mixed toward `elevation.1.surface`, or given reduced alpha                                                                                                                                                                            |
| `text.strong`                                                                                            | alias of `neutral.text-strong` — the neutral role's own grid, reused for content emphasis                                                                                                                                                         |
| `text.inverse`                                                                                           | `text.base` of the _other_ color-scheme mode — the one legitimate cross-mode read                                                                                                                                                                 |
| `link.base` / `-hover` / `-visited`                                                                      | `primary.text` and its state cells, hue-shifted for visited                                                                                                                                                                                       |
| `scrim`                                                                                                  | near-black veil at fixed alpha                                                                                                                                                                                                                    |
| `ring`                                                                                                   | primary, lightened in dark mode for visibility                                                                                                                                                                                                    |
| `space.*`, `size.control.*`, `border-width.*`, `breakpoint.*`, `z.*`, `type.*`, `duration.*`, `easing.*` | catalog-default constants (`defaulted`) unless you author them — the same values every exporter that needs a spacing/type/motion scale now shares                                                                                                 |
| `palette.categorical.1–8`                                                                                | data-viz palette: hues rotated from your brand anchor, lightness/chroma banded for adjacent distinguishability; feeds shadcn's `--chart-1…5` (first five, frozen) and [ECharts' `color[]`](/docs/exporter-echarts/) (all eight)                   |

Approximate OKLCH values in this table are produced by real color math in `packages/core/src/color.js` — including proper OKLab↔sRGB conversion and WCAG 2.1 contrast ratios.

## The component tier: defaults that layer

`component.*` slots derive too, but by a different mechanism: each one declares a `defaultFrom` — the semantic slot it falls back to when you say nothing.

| Slot                          | Defaults from                 | Meaning                                         |
| ----------------------------- | ----------------------------- | ----------------------------------------------- |
| `component.control.radius`    | `semantic.radius.control`     | the shared shape of form controls               |
| `component.control.padding-x` | `semantic.space.4`            | horizontal padding shared by controls           |
| `component.control.padding-y` | `semantic.space.2`            | vertical padding shared by controls             |
| `component.button.radius`     | `component:control.radius`    | a button is a control — until you say otherwise |
| `component.button.padding-x`  | `component:control.padding-x` | ″                                               |
| `component.button.padding-y`  | `component:control.padding-y` | ″                                               |
| `component.tooltip.max-width` | — (authored only)             | how wide a tooltip may grow                     |

The `component:` prefix is what makes the tier **layered rather than flat**, and it is the difference between two authoring intentions that would otherwise be indistinguishable:

- Author `component.control.radius` → **buttons and inputs both move.** You changed the shared control shape.
- Author `component.button.radius` → **only buttons move.** You made a button-specific decision, and inputs keep following the control default.

That asymmetry is the whole point. One line expresses either intent, and the exporters reproduce it on targets that model the relationship completely differently — Bootstrap chains buttons and inputs through a shared `$input-btn-*` root, PrimeNG keeps `button.*` and `formField.*` fully separate, and the same authored token lands correctly in both.

**A slot can have no default at all.** `component.tooltip.max-width` declares none, because the IR has no rung meaning "a readable measure" and synthesizing one would mean adopting a number on one library's authority. So it exists **only when you author it** — and when you don't, Bootstrap and PrimeNG each keep their own default, which happens to be the same 200px. That agreement is why the slot exists: both libraries independently constrain the same element the same way at the same measure, and PrimeNG carries only two `maxWidth` slots in its entire 2759-slot surface ([proposal 0004](https://github.com/julien-deramond/transtyle/blob/main/docs/proposals/0004-component-geometry.md)).

**If the source doesn't exist, neither does the slot.** A design system that authors no radius scale has no `semantic.radius.control`, so `component.control.radius` is simply absent rather than present-and-empty — and an exporter with a binding for it emits nothing, reporting a `dropped` coverage row that names the slot to author. See [a three-token design system is valid](/docs/diagnostics/#a-three-token-design-system-is-valid-and-a-target-variable-just-goes-missing).

## Provenance classes

`derived` values track your brand: change `primary` and every derived value follows (hover tints, on-colors, the whole chart palette — see it live by editing the Acme example and rebuilding). `defaulted` values are catalog constants with no user input. The distinction matters for audits: the report can tell you "your theme is 43% authored, 54% derived, 3% approximated".

## What derivation refuses to do

- **Invent your dark theme** (unless you opt in with `autoDark: true`, and even then everything is flagged `derived`). Dark brand adjustment is a design decision; the engine won't take it from you silently.
- **Have taste.** Derivation guarantees _coherence_, not _art direction_. On the [Cathode terminal theme](/docs/examples/#cathode--the-hostile-example), derived `info` comes out conventionally blue — coherent, aesthetically wrong for a monochrome CRT, and fixed by one authored line. That boundary is by design.
- **Run your code.** Rules are declarative and shipped in versioned packs; there is deliberately no JS escape hatch in token processing. If the rule language is insufficient, that's a spec conversation, not a plugin.

## Practical workflow

1. Author the minimum you have opinions about (brand color, neutrals, dark neutrals, radius, fonts).
2. Build; read `report.json` and the `· derived` comments in the output.
3. Where a derived value is wrong for you, author that token. Repeat. Your token file grows exactly as fast as your opinions do.
