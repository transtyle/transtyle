---
title: 'Radix Colors / Themes exporter'
description: "12-step scales, alpha ramps, and a contrast color per role — the role grid's own acceptance test."
order: 14
---

# Radix Colors / Themes exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/radix/">Acme</a> · <a href="/demo/cathode/radix/">Cathode</a> · <a href="/demo/govuk/radix/">GOV.UK</a> · <a href="/demo/carbon/radix/">Carbon</a> — one page, four design systems, compiled to Radix Themes. <a href="/demo/">All 32 demos →</a></p>
</div>

Radix's 12-step-per-color model is, cell for cell, [the role grid](/docs/language/#color-roles-the-role-grid) — numbered instead of named. That makes this exporter the grid's own acceptance test: only 2 of 12 steps need a fresh mix (steps 2 and 6), everything else is a direct grid cell.

<!-- measured: acme.radix.decls = 450 -->
<!-- measured: acme.radix.rows = 203 -->

On [Acme](/docs/examples/) that is 450 declarations — 12 steps plus a 12-step alpha ramp per role, in both modes — over 203 classified rows.

```json
"targets": { "radix": { "output": "dist/radix" } }
```

## Mapping

| Radix step | Meaning                                | Comes from                                                                                |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1          | App background                         | `elevation.0.surface`                                                                     |
| 2          | Subtle background                      | mix toward the page, 96% — no direct cell                                                 |
| 3 / 4 / 5  | UI background · hover · active         | `tint` / `tint-hover` / `tint-active`                                                     |
| 6          | Subtle border                          | mix toward the card surface, 78% — no direct cell, fills the gap between tint and outline |
| 7 / 8      | Border · hover border                  | `outline` / `outline-hover`                                                               |
| 9 / 10     | Solid · hover solid                    | `solid` / `solid-hover`                                                                   |
| 11 / 12    | Low-contrast text · high-contrast text | `text` / `text-strong`                                                                    |
| `contrast` | Text on the solid fill                 | `on-solid`                                                                                |
| `a1`–`a12` | Alpha variants                         | the same 12 colors, alpha from a fixed ramp — not Radix's real per-color alpha algorithm  |

`neutral` also ships as `--gray-*`, Radix's conventional paired-gray name.

## An honest gap, found by building this — and fixed

Any step that falls outside the sRGB gamut gets flagged `approximated` too — browsers gamut-map `oklch()` on render, which can look different from what was intended. Building this exporter surfaced a real one: `text-strong` (step 12) re-anchors a role at the _content_ text lightness while keeping the role's _full_ chroma — for a vivid brand color in dark mode, that combination could leave the gamut (very light + very saturated has little headroom). Fixed at the derivation source (`clampChromaToGamut`, [role grid](/docs/language/#color-roles-the-role-grid) F20) rather than only flagged downstream — it now reduces chroma at the same lightness/hue until the color is representable, instead of leaving it to be clipped per-channel on render.

## Using it with `@radix-ui/themes`

Radix's `<Theme accentColor="...">` only accepts its own preset names, so to drive real Radix components from your brand you **override an existing preset** rather than invent a new one:

```css
:root {
  --violet-1: var(--primary-1); /* ...through 12, plus -a1..a12 and -contrast */
}
```

```jsx
<Theme accentColor="violet" grayColor="gray">
```

See it running on real `@radix-ui/themes` components: `npm run dev -w acme-demo-radix` (or `cathode-demo-radix`) in the [examples](/docs/examples/).
