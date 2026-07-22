# Exporter spec: Radix Colors / Themes

> **Status: implemented** (`@transtyle/exporter-radix`).

**Why it's a reference exporter:** Radix's 12-step-per-color model (steps 1–12: app bg → subtle bg → UI bg → hover → active → subtle border → border → hover border → solid → solid hover → low-contrast text → high-contrast text, plus a paired alpha scale and a "contrast" on-solid color) is, cell-for-cell, [the role grid](../../architecture/ir.md#color-the-role-grid) — just numbered instead of named. This makes it the grid's **acceptance test**: only 2 of the 12 steps (2 and 6) have no direct grid cell and need a fresh mix; if that's the only gap, the grid is validated as a real universal projection, not a shape reverse-engineered from shadcn or Bootstrap.

## Emitted artifacts

| File                         | Purpose                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `radix-colors.transtyle.css` | `:root` (light) + `.dark` blocks; per role: `--<role>-1..12`, `--<role>-a1..a12` (alpha variants), `--<role>-contrast`; `neutral` is also aliased as `--gray-*` (Radix's conventional paired-gray name) |
| `usage.md`                   | Standalone usage + the `@radix-ui/themes` override pattern                                                                                                                                              |

## Mapping (per role, both modes)

| Step       | Comes from                                  | Class                                                                            |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| 1          | `elevation.0.surface`                       | `native`                                                                         |
| 2          | `mix(solid, elevation.0.surface, 0.96)`     | `approximated` — no direct grid cell                                             |
| 3 / 4 / 5  | `tint` / `tint-hover` / `tint-active`       | `native`                                                                         |
| 6          | `mix(solid, elevation.1.surface, 0.78)`     | `approximated` — no direct grid cell; sits between the tint and outline families |
| 7 / 8      | `outline` / `outline-hover`                 | `native`                                                                         |
| 9 / 10     | `solid` / `solid-hover`                     | `native`                                                                         |
| 11 / 12    | `text` / `text-strong`                      | `native`                                                                         |
| `contrast` | `on-solid`                                  | `native`                                                                         |
| `a1`–`a12` | the same 12 colors, alpha from a fixed ramp | `approximated` — not a colorimetric derivation of Radix's real per-color alpha   |

Any step whose OKLCH value falls outside the sRGB gamut (`ctx.formatHex(...).clamped`) is additionally marked `approximated` with a note — browsers gamut-map `oklch()` on render, which can look noticeably different from the intended color. Building this exporter surfaced exactly this gap in the `text-strong` derivation rule (F20): it re-anchors a role at the _content_ text lightness while keeping the role's _full_ chroma, which could leave the sRGB gamut for vivid brand colors in dark mode (a very light, fully saturated color has very little gamut headroom). Fixed at the source: F20 now runs the result through `clampChromaToGamut` (`packages/core/src/color.js`), which reduces chroma at the same lightness/hue until the color is representable, rather than letting per-channel clipping distort it downstream. See the worklog for the fix and its one (expected, corrected) fixture-value change.

## `@radix-ui/themes` integration

Radix's `<Theme accentColor="...">` component only accepts its own preset names — it can't take an arbitrary string. To drive real Radix Themes components from a compiled brand, **override an existing preset's CSS variables** with your role's scale (e.g. `--violet-1` through `--violet-12`, `-a1..a12`, `-contrast`), then pass that preset's name to `accentColor`. `--gray-*` needs no override — it's already Radix's own name.

## Ground-truth testing

`examples/*/demo/radix/` — a real `@radix-ui/themes` React app overriding one preset with the compiled `primary` scale and `gray` with `neutral`, rendering the same fake page other demos use, with real Radix `Button`/`Card`/`Dialog` components.
