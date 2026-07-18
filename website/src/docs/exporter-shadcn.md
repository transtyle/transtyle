---
title: "shadcn/ui exporter"
description: "Era profiles, the mapping table, mode handling, honest limits."
order: 8
---

# shadcn/ui exporter

The first reference exporter. shadcn's theme *is* a set of semantic CSS variables, so it exercises the semantic catalog almost 1:1 — which made it the right target to build first and the cleanest to learn from.

## Era profiles

shadcn isn't a versioned library; its theming convention shifted with the Tailwind v3 → v4 transition. The exporter ships two **profiles**, selected in config via `options.era` (see [target instances](/docs/configuration/#targets--instances-not-just-names)):

| | `tailwind-v4` (default) | `tailwind-v3` |
|---|---|---|
| Color syntax | OKLCH values | HSL channel triplets (`221 83% 53%`) |
| Artifacts | `globals.transtyle.css` (`:root` + `.dark` + `@theme inline`) | `globals.transtyle.css` (`@layer base`) + `tailwind.theme.transtyle.cjs` |
| Wiring | `@theme inline` maps variables to Tailwind utilities | Merge the `.cjs` snippet into `tailwind.config` (`hsl(var(--x))` convention) |
| Fidelity note | Lossless within sRGB | OKLCH → HSL may gamut-clamp; clamped variables are classified `approximated` |

```json
"targets": {
  "shadcn":    { "options": { "era": "tailwind-v4" }, "output": "dist/shadcn" },
  "shadcn-v3": { "exporter": "shadcn", "options": { "era": "tailwind-v3" }, "output": "dist/shadcn-v3" }
}
```

## What maps where

The full 33-variable set is emitted; highlights worth understanding:

| shadcn variable | Comes from | Note |
|---|---|---|
| `--background` / `--foreground` | `background.base` / `text.base` | |
| `--card` / `--popover` | `surface.base` / `overlay.base` | overlay = floating-layer surface, derived by raising `surface` |
| `--primary` + `--primary-foreground` | `primary.base` + `text-on-primary.base` | the foreground is contrast-picked and AA-checked |
| `--secondary`, `--muted` | `neutral.subtle` | **shadcn's "secondary" is a subtle surface, not your brand secondary** — a deliberate mapping decision |
| `--accent` + `--accent-foreground` | `accent.subtle` + `text-on-accent.subtle` | derived accent is brand-tinted — visibly nicer than stock shadcn's flat gray |
| `--destructive` | `danger.base` | name translation only |
| `--input` | `border.base` | classified `approximated`: shadcn distinguishes input borders, the catalog doesn't (yet) |
| `--ring` | `ring.base` | derived from primary, lightened in dark mode |
| `--chart-1…5` | `palette.categorical.1–5` | derived data-viz palette anchored on your brand hue |
| `--sidebar-*` | surface/text/primary/accent | exporter convention; properly a component-tier concern (v2) |
| `--radius` | `radius.md` | shadcn derives sm/md/lg/xl from it via `calc()` |
| `--font-sans` / `--font-mono` | `font.sans` / `font.mono` | v4: `@theme`; v3: `fontFamily` in the config snippet |

Every mapping decision is recorded per-variable in `report.json` with its coverage class and provenance.

## Mode handling

`color-scheme` maps to shadcn's class strategy: `:root` gets **light** values, `.dark` gets dark. This binds mode *names* — a dark-native design system ([Cathode](/docs/examples/#cathode-the-hostile-example)) compiles correctly, its native look under `.dark`.

## Out of scope, honestly

- `components.json` with `cssVariables: false` (utility-class theming): without variables there's no theme artifact — theming would mean rewriting your component files, which Transtyle will never do.
- Non-Tailwind projects: shadcn itself requires Tailwind. The `:root`/`.dark` blocks are self-contained CSS if you want just the variables; a dedicated framework-free `css-variables` exporter is specced.

## Using the output

Each build writes a `usage.md` with era-specific paste-in steps next to the theme. Short version, v4: import `globals.transtyle.css` after Tailwind, toggle `dark` on `<html>`. v3: import the globals file, merge the `.cjs` theme into `tailwind.config`, set `darkMode: ["class"]`.
