---
title: "Getting started"
description: "From clone to a compiled shadcn theme in four steps."
order: 2
---

# Getting started

Transtyle is not yet published to npm, so you run it from the monorepo. Node ≥ 18 is the only requirement — the project has **zero external dependencies**, so `npm install` just links the workspace packages.

## 1. Clone and link

```bash
git clone https://github.com/transtyle/transtyle
cd transtyle
npm install
```

## 2. Compile an example

```bash
cd examples/acme
npx transtyle build shadcn
```

Output lands in `dist/shadcn/`:

- `globals.transtyle.css` — the complete shadcn theme (light + dark + `@theme inline`)
- `usage.md` — generated paste-in instructions for your target project
- `report.json` — coverage classification and provenance for every variable

`npx transtyle check` runs the same pipeline without writing files: schema validation, alias/cycle checks, WCAG contrast checks, coverage summary.

## 3. Use the theme in a real project

For a Tailwind v4 shadcn app: copy `globals.transtyle.css` next to your global stylesheet and import it after Tailwind:

```css
@import "tailwindcss";
@import "./globals.transtyle.css";
```

Dark mode uses the standard shadcn class strategy — toggle `dark` on `<html>`. Details for the Tailwind v3 era are in the [shadcn exporter page](/docs/exporter-shadcn/).

## 4. Create your own design system

There is no `transtyle init` yet (specced, not implemented), so scaffold by hand. Minimal viable project — two files:

```
my-ds/
  transtyle.config.json
  tokens/brand.tokens.json
```

`transtyle.config.json`:

```json
{
  "name": "my-design-system",
  "tokens": ["tokens/*.tokens.json"],
  "modes": { "color-scheme": { "values": ["light", "dark"], "default": "light" } },
  "derivation": { "rules": "standard@1", "require": ["semantic.color.primary"] },
  "targets": { "shadcn": { "output": "dist/shadcn", "options": { "era": "tailwind-v4" } } },
  "check": { "failOn": "error", "contrast": { "standard": "wcag21-aa" } }
}
```

`tokens/brand.tokens.json` — the honest minimum is one brand color plus your neutral surfaces (see [Authoring tokens](/docs/authoring-tokens/) for the full picture and [Concepts](/docs/concepts/) for why these names):

```json
{
  "semantic": {
    "color": {
      "$type": "color",
      "primary": { "base": { "$value": "oklch(0.55 0.18 255)" } },
      "background": { "base": { "$value": "oklch(1 0 0)",
        "$extensions": { "transtyle.modes": { "color-scheme": { "dark": "oklch(0.15 0.01 255)" } } } } },
      "text": { "base": { "$value": "oklch(0.22 0.01 255)",
        "$extensions": { "transtyle.modes": { "color-scheme": { "dark": "oklch(0.98 0 0)" } } } } }
    }
  }
}
```

Everything you don't author — hover states, on-colors, secondary, borders' defaults, the chart palette — is [derived deterministically](/docs/derivation/), and the report tells you exactly what was derived so you can override selectively.

Run it from inside the monorepo (`npx` resolves the workspace binary from any subdirectory), or link the CLI globally to use it anywhere:

```bash
cd packages/cli && npm link     # once
transtyle build --cwd ~/anywhere/my-ds
```

## Where next

- [Core concepts](/docs/concepts/) — tiers, the semantic catalog, modes, provenance
- [Configuration](/docs/configuration/) — every manifest field
- [Weird things & diagnostics](/docs/diagnostics/) — when output surprises you, it's explained there
