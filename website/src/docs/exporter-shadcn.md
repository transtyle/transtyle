---
title: 'shadcn/ui exporter'
description: 'Era profiles, the mapping table, mode handling, honest limits.'
order: 8
---

# shadcn/ui exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/shadcn/">Acme</a> · <a href="/demo/cathode/shadcn/">Cathode</a> · <a href="/demo/govuk/shadcn/">GOV.UK</a> · <a href="/demo/carbon/shadcn/">Carbon</a> — one page, four design systems, compiled to shadcn/ui. <a href="/demo/">All 32 demos →</a></p>
</div>

The first reference exporter. shadcn's theme _is_ a set of semantic CSS variables, so it exercises the semantic catalog almost 1:1 — which made it the right target to build first and the cleanest to learn from.

<!-- measured: acme.shadcn.decls = 103 -->
<!-- measured: acme.shadcn.distinct = 71 -->

On the [Acme example](/docs/examples/) that is 103 custom-property declarations across `:root` and `.dark` — 71 distinct variables, each one classified in `report.json`.

## Era profiles

shadcn isn't a versioned library; its theming convention shifted with the Tailwind v3 → v4 transition. The exporter ships two **profiles**, selected in config via `options.era` (see [target instances](/docs/configuration/#targets--instances-not-just-names)):

|               | `tailwind-v4` (default)                                       | `tailwind-v3`                                                                |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Color syntax  | OKLCH values                                                  | HSL channel triplets (`221 83% 53%`)                                         |
| Artifacts     | `globals.transtyle.css` (`:root` + `.dark` + `@theme inline`) | `globals.transtyle.css` (`@layer base`) + `tailwind.theme.transtyle.cjs`     |
| Wiring        | `@theme inline` maps variables to Tailwind utilities          | Merge the `.cjs` snippet into `tailwind.config` (`hsl(var(--x))` convention) |
| Fidelity note | Lossless within sRGB                                          | OKLCH → HSL may gamut-clamp; clamped variables are classified `approximated` |

```json
"targets": {
  "shadcn":    { "options": { "era": "tailwind-v4" }, "output": "dist/shadcn" },
  "shadcn-v3": { "exporter": "shadcn", "options": { "era": "tailwind-v3" }, "output": "dist/shadcn-v3" }
}
```

## What maps where

The full 33-variable set is emitted; highlights worth understanding:

| shadcn variable                      | Comes from                                    | Note                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background` / `--foreground`      | `elevation.0.surface` / `text.base`           |                                                                                                                                                                  |
| `--card` / `--popover`               | `elevation.1.surface` / `elevation.3.surface` | the role-grid elevation ladder: card is one step up from the page, popover another two — see the [language reference](/docs/language/#color-roles-the-role-grid) |
| `--primary` + `--primary-foreground` | `primary.solid` + `primary.on-solid`          | the foreground is contrast-picked and AA-checked                                                                                                                 |
| `--secondary`, `--muted`             | `neutral.tint`                                | **shadcn's "secondary" is a subtle surface, not your brand secondary** — a deliberate mapping decision                                                           |
| `--accent` + `--accent-foreground`   | `accent.tint` + `accent.on-tint`              | derived accent is brand-tinted — visibly nicer than stock shadcn's flat gray                                                                                     |
| `--destructive`                      | `danger.solid`                                | name translation only                                                                                                                                            |
| `--input`                            | `border`                                      | classified `approximated`: shadcn distinguishes input borders, the catalog doesn't (yet)                                                                         |
| `--ring`                             | `ring`                                        | derived from primary, lightened in dark mode                                                                                                                     |
| `--chart-1…5`                        | `palette.categorical.1–5`                     | derived data-viz palette anchored on your brand hue                                                                                                              |
| `--sidebar-*`                        | elevation/text/primary/accent grid cells      | exporter convention; properly a component-tier concern (v2)                                                                                                      |
| `--radius`                           | `radius.md`                                   | shadcn derives sm/md/lg/xl from it via `calc()`                                                                                                                  |
| `--font-sans` / `--font-mono`        | `font.sans` / `font.mono`                     | v4: `@theme`; v3: `fontFamily` in the config snippet                                                                                                             |

Every mapping decision is recorded per-variable in `report.json` with its coverage class and provenance.

## Mode handling

`color-scheme` maps to shadcn's class strategy: `:root` gets **light** values, `.dark` gets dark. This binds mode _names_ — a dark-native design system ([Cathode](/docs/examples/#cathode--the-hostile-example)) compiles correctly, its native look under `.dark`.

## Out of scope, honestly

- `components.json` with `cssVariables: false` (utility-class theming): without variables there's no theme artifact — theming would mean rewriting your component files, which Transtyle will never do.
- Non-Tailwind projects: shadcn itself requires Tailwind. The `:root`/`.dark` blocks are self-contained CSS if you want just the variables; the dedicated framework-free [css-variables exporter](/docs/exporter-css-variables/) covers this properly.

## Using the output

Each build writes a `usage.md` with era-specific paste-in steps next to the theme. Short version, v4: import `globals.transtyle.css` after Tailwind, toggle `dark` on `<html>`. v3: import the globals file, merge the `.cjs` theme into `tailwind.config`, set `darkMode: ["class"]`.
