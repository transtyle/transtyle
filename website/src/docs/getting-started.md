---
title: 'Getting started'
description: 'From npm install to a compiled theme in four steps.'
order: 2
---

# Getting started

Transtyle is on npm as an alpha: `@transtyle/cli`. Node ≥ 22.12 is the only requirement — the compiler has **zero external dependencies**, so installing it brings nothing else with it.

<div class="callout"><span class="callout-title">Already have a design system?</span>

This page builds a project from scratch. The more common path — keeping your existing names and values and binding them to the catalog — is [You already have a design system](/docs/adopt-existing/).

</div>

## 1. Install

```bash
npm i -D @transtyle/cli
npx transtyle --version
```

Pin the exact version while the project is in alpha: the token vocabulary, the generated output and the CLI surface can each change between alpha releases. Rather look before you install? The repository ships [four complete design systems](#5-or-start-from-the-examples) you can compile without authoring a token.

## 2. Scaffold your design system

```bash
mkdir my-ds && cd my-ds
npx transtyle init
```

In a terminal, `init` asks five questions: your brand color, light and dark or light only, which targets, a preset and a file layout. Press Enter to take a default; every question also has a flag (`--brand '#e8590c' --targets shadcn,bootstrap`), and without a terminal it asks nothing. The [CLI reference](/docs/cli/#transtyle-init-name) lists them all.

The default `recommended` preset authors the honest minimum — **six real decisions**, each marked `TODO` with a description of what it is:

| You author       | Catalog slot          | Why you author it                      |
| ---------------- | --------------------- | -------------------------------------- |
| Your brand color | `primary.solid`       | The one non-negotiable input           |
| Page background  | `elevation.0.surface` | Anchors the whole surface ladder       |
| Card background  | `elevation.1.surface` | First rung above the page              |
| Body text color  | `text.base`           | Anchors the content hierarchy          |
| Muted text color | `text.muted`          | Second rung of that hierarchy          |
| Default border   | `border`              | The neutral hairline everything shares |

The five neutrals start as a near-gray ladder in your brand's hue, each with a dark value: placeholders that already pass contrast, not your design. Only the brand color is required. Leave the page background out and it defaults to white, or near-black in dark mode; leave the body text out and it defaults to whichever of near-black and white contrasts more with the page. Both are honest defaults, marked `defaulted` in `report.json`, and the five other decisions are what make the neutrals yours. (Card background and muted text derive from the page and the text too; the scaffold asks for them because they are part of your look.) The `minimal` preset (`--preset minimal`) writes the brand color alone and leaves all of that to the defaults.

In DTCG form (this is the default scaffold's `tokens/brand.tokens.json`, abridged):

```json
{
  "$schema": "https://transtyle.dev/schemas/tokens/v0.json",
  "option": {
    "color": { "$type": "color", "brand": { "500": { "$value": "oklch(0.55 0.18 255)" } } }
  },
  "semantic": {
    "color": {
      "$type": "color",
      "primary": { "solid": { "$value": "{option.color.brand.500}" } },
      "elevation": {
        "0": { "surface": { "$value": "oklch(1 0 0)" } },
        "1": { "surface": { "$value": "oklch(0.985 0.003 255)" } }
      },
      "text": {
        "base": { "$value": "oklch(0.21 0.01 255)" },
        "muted": { "$value": "oklch(0.5 0.01 255)" }
      },
      "border": { "$value": "oklch(0.9 0.006 255)" }
    }
  }
}
```

Note the two tiers: `option.color.brand.500` is _your_ name for _your_ value; `primary.solid` is the catalog slot that aliases it. The dark values sit in `tokens/brand.dark.tokens.json`, a mode-scoped DTCG file the config loads for `color-scheme: dark` only:

```json
"tokens": [
  "tokens/brand.tokens.json",
  { "files": "tokens/brand.dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

Values can also go inline per token — see [Authoring tokens](/docs/authoring-tokens/#modes). Before it exits, `init` checks the new project and shows your brand color with the text color derived for it.

## 3. Add targets and build

```bash
npx transtyle build             # starts with css-variables
npx transtyle add shadcn        # registers another target in the config
npx transtyle add bootstrap     # …any of the ten official exporters
npx transtyle build
```

Each target gets a directory under `dist/` holding its native artifacts, a generated `usage.md` telling you how to wire them into that ecosystem, and a `report.json` recording where every value came from.

Everything you didn't author — hover states, on-colors, `secondary`, the full role grids, the chart palette — is <span class="prov derived">derived</span> deterministically, and `report.json` says so per variable, so you can override selectively: author any slot and derivation yields to you.

Two more commands to know early:

```bash
npx transtyle check                    # same pipeline, no files written:
                                       # validation, alias cycles, WCAG contrast, coverage
npx transtyle explain primary.tint     # why does this value exist? full derivation chain
```

## 4. Use the theme in a real project

For a Tailwind v4 shadcn app: copy `globals.transtyle.css` next to your global stylesheet and import it after Tailwind:

```css
@import 'tailwindcss';
@import './globals.transtyle.css';
```

Dark mode uses the standard shadcn class strategy — toggle `dark` on `<html>`. Details for the Tailwind v3 era are in the [shadcn exporter page](/docs/exporter-shadcn/). Every target works the same way: build, then follow the generated `usage.md`. To _see_ a theme on real components first, each example ships [runnable demo projects](/docs/examples/) per target.

## 5. Or start from the examples

Nothing beats reading a design system that already compiles. The monorepo ships four, with runnable demos for every target:

```bash
git clone https://github.com/transtyle/transtyle
cd transtyle
npm install                  # zero external dependencies — this just links the workspaces
cd examples/acme
npx transtyle build shadcn
```

Output lands in `dist/shadcn/`:

- `globals.transtyle.css` — the complete shadcn theme (light + dark + `@theme inline`)
- `usage.md` — generated paste-in instructions for your target project
- `report.json` — coverage classification and provenance for every variable

[Your first build](/docs/your-first-build/) walks through that output line by line.

## Where next

- [Core concepts](/docs/concepts/) — the pipeline, tiers, the semantic catalog, modes, provenance
- [The Transtyle language](/docs/language/) — every catalog slot, with derivation rules and per-exporter consumers
- [Configuration](/docs/configuration/) — every manifest field
- [Weird things & diagnostics](/docs/diagnostics/) — when output surprises you, it's explained there
