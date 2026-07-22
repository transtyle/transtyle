---
title: "Your first build"
description: "A ten-minute walkthrough of the Acme example: build, read the output, ask why."
order: 22
---

# Your first build

Ten minutes, using the [Acme example](/docs/examples/) that ships in the repository. Every output shown on this page is real — produced by running exactly these commands.

## 1. Set up

```bash
git clone https://github.com/transtyle/transtyle
cd transtyle
npm install          # zero external dependencies — this just links the workspaces
cd examples/acme
```

## 2. Look at what Acme decides

Open `tokens/semantic.tokens.json`. Acme's decision layer is deliberately tiny — one brand color, two surfaces, two text colors, a border, a radius, two fonts:

```json
"primary":   { "solid": { "$value": "{option.color.blue.600}" } },
"elevation": { "0": { "surface": { "$value": "{option.color.white}" } },
               "1": { "surface": { "$value": "{option.color.gray.50}" } } },
"text":      { "base":  { "$value": "{option.color.gray.900}" } },
"border":    { "$value": "{option.color.gray.200}" }
```

The `{option.color.blue.600}` references point at `tokens/option.tokens.json` — the raw palette, under Acme's own names. Dark-mode values live alongside (Acme uses the inline form; [separate mode files](/docs/authoring-tokens/#modes) are the recommended layout for real teams).

## 3. Build

```bash
npx transtyle build shadcn
```

```
shadcn  42% native · 53% derived · 3% approximated · 3% dropped
  ↳ dist/shadcn/globals.transtyle.css
  ↳ dist/shadcn/usage.md
  ↳ dist/shadcn/report.json

✔ build complete
```

That first line is the [coverage summary](/docs/concepts/#5-provenance-and-coverage): under half of shadcn's variable set came straight from Acme's decisions; most of the rest was computed *from* them; a sliver was bent to fit; and one thing shadcn can't express was dropped — with a note, not silently.

## 4. Read the output

Open `dist/shadcn/globals.transtyle.css`. Every line says where its value came from:

```css
:root {
  --radius: 0.5rem; /* radius.md */
  --background: oklch(1 0 0); /* color.elevation.0.surface */
  --card: oklch(0.985 0.003 255); /* color.elevation.1.surface */
  --popover: oklch(1 0 0); /* color.elevation.3.surface · derived */
  --primary: oklch(0.55 0.18 255); /* color.primary.solid */
  ...
```

`--background` and `--primary` trace to authored decisions. `--popover` carries `· derived` — Acme never decided a popover color, so a rule proposed one from the surface ladder. This file is disposable on purpose: never edit it, regenerate it.

## 5. Ask why

The compiler answers for any value:

```bash
npx transtyle explain primary.tint
```

```
semantic.color.primary.tint = oklch(0.95 0.017 255)  [#e7effa]
 └─ derived by rule mix-toward-surface(0.92)@standard@1
    inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
     └─ aliased → option.color.blue.600
    inputs: semantic.color.elevation.1.surface = oklch(0.985 0.003 255)  [#f9fafc]
     └─ aliased → option.color.gray.50
```

Read bottom-up: Acme authored a blue and a surface; a named, versioned rule (`mix-toward-surface`, from the `standard@1` pack) mixed them into the subtle tint. Nothing in the output lacks this paper trail.

## 6. Read the report

`dist/shadcn/report.json` grades every variable. Three real entries:

```json
{ "variable": "--accent", "slot": "semantic.color.accent.tint",
  "class": "derived", "provenance": "derived" }

{ "variable": "--input", "slot": "semantic.color.border",
  "class": "approximated", "provenance": "aliased" }

{ "variable": "(mode:density)", "slot": "—", "class": "dropped",
  "note": "density mode dimension not expressed by this target" }
```

The middle one is honesty at work: shadcn wants a dedicated input-border color, Acme only has the one border — the mapping works but bends the meaning, so it's graded `approximated`, not passed off as native. The last one: Acme declares a `density` mode, shadcn has no such axis — dropped, with the reason.

## 7. Override a proposal

Any derived value is yours to take over. Author the slot — for example, decide `accent.tint` yourself in `tokens/semantic.tokens.json` — rebuild, and the report's entry flips from <span class="prov derived">derived</span> to <span class="prov authored">authored</span>. Derivation never argues with you.

## 8. See it on real components

```bash
cd ../..
npm run dev -w acme-demo-shadcn     # the same page in real shadcn/ui components, port 4103
```

Each example ships one [demo project per target](/docs/examples/), consuming only the compiled `dist/` — the fastest way to eyeball a theme on the components it will actually style.

## Where next

- Do it for **your** system: [You already have a design system](/docs/adopt-existing/) — bind your names, rename nothing
- The full vocabulary you just compiled through: [the Transtyle language](/docs/language/)
- Every field of `transtyle.config.json`: [Configuration](/docs/configuration/)
