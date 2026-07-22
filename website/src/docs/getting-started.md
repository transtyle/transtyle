---
title: 'Getting started'
description: 'From clone to a compiled theme in four steps.'
order: 2
---

# Getting started

Transtyle is not yet published to npm, so you run it from the monorepo. Node ≥ 18 is the only requirement — the compiler has **zero external dependencies**, so `npm install` just links the workspace packages.

<div class="callout"><span class="callout-title">Already have a design system?</span>

This page builds a project from scratch. The more common path — keeping your existing names and values and binding them to the catalog — is [You already have a design system](/docs/adopt-existing/).
</div>

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

Two commands to know before anything else:

```bash
npx transtyle check                    # same pipeline, no files written:
                                       # validation, alias cycles, WCAG contrast, coverage
npx transtyle explain primary.tint     # why does this value exist? full derivation chain
```

## 3. Use the theme in a real project

For a Tailwind v4 shadcn app: copy `globals.transtyle.css` next to your global stylesheet and import it after Tailwind:

```css
@import 'tailwindcss';
@import './globals.transtyle.css';
```

Dark mode uses the standard shadcn class strategy — toggle `dark` on `<html>`. Details for the Tailwind v3 era are in the [shadcn exporter page](/docs/exporter-shadcn/). Every target works the same way: build, then follow the generated `usage.md`. To _see_ a theme on real components first, each example ships [runnable demo projects](/docs/examples/) per target.

## 4. Create your own design system

```bash
mkdir my-ds && cd my-ds
npx transtyle init          # scaffolds transtyle.config.json + tokens/brand.tokens.json
```

The scaffold authors the honest minimum — **six real decisions**, each marked `TODO` with a description of what it is:

| You author       | Catalog slot          | Why it can't be derived                |
| ---------------- | --------------------- | -------------------------------------- |
| Your brand color | `primary.solid`       | The one non-negotiable input           |
| Page background  | `elevation.0.surface` | Anchors the whole surface ladder       |
| Card background  | `elevation.1.surface` | First rung above the page              |
| Body text color  | `text.base`           | Anchors the content hierarchy          |
| Muted text color | `text.muted`          | Second rung of that hierarchy          |
| Default border   | `border`              | The neutral hairline everything shares |

In DTCG form (this is the scaffold's `tokens/brand.tokens.json`, abridged):

```json
{
  "option": {
    "color": { "$type": "color", "brand": { "500": { "$value": "oklch(0.55 0.18 255)" } } }
  },
  "semantic": {
    "color": {
      "$type": "color",
      "primary": { "solid": { "$value": "{option.color.brand.500}" } },
      "elevation": {
        "0": { "surface": { "$value": "oklch(1 0 0)" } },
        "1": { "surface": { "$value": "oklch(0.98 0.003 255)" } }
      },
      "text": {
        "base": { "$value": "oklch(0.2 0.01 255)" },
        "muted": { "$value": "oklch(0.5 0.01 255)" }
      },
      "border": { "$value": "oklch(0.9 0.005 255)" }
    }
  }
}
```

Note the two tiers: `option.color.brand.500` is _your_ name for _your_ value; `primary.solid` is the catalog slot that aliases it. Dark-mode values go in a separate mode-scoped DTCG file (the recommended layout) or inline per token — see [Authoring tokens](/docs/authoring-tokens/#modes).

Then build, and add targets as you need them:

```bash
npx transtyle build             # starts with css-variables
npx transtyle add shadcn        # registers another target in the config
npx transtyle add bootstrap     # …any of the eight official exporters
npx transtyle build
```

Everything you didn't author — hover states, on-colors, `secondary`, the full role grids, the chart palette — is <span class="prov derived">derived</span> deterministically, and `report.json` says so per variable, so you can override selectively: author any slot and derivation yields to you.

Run it from inside the monorepo (`npx` resolves the workspace binary from any subdirectory), or link the CLI globally to use it anywhere:

```bash
cd packages/cli && npm link     # once
transtyle build --cwd ~/anywhere/my-ds
```

## Where next

- [Core concepts](/docs/concepts/) — the pipeline, tiers, the semantic catalog, modes, provenance
- [The Transtyle language](/docs/language/) — every catalog slot, with derivation rules and per-exporter consumers
- [Configuration](/docs/configuration/) — every manifest field
- [Weird things & diagnostics](/docs/diagnostics/) — when output surprises you, it's explained there
