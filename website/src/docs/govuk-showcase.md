---
title: 'GOV.UK, end to end'
description: 'A real, independently-designed system compiled to eight ecosystems — the tokens, the judgment calls, and the honest coverage, all shown.'
order: 30
---

# GOV.UK, end to end

The [GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/) is a real, public, independently-designed system — nobody on this project built it. This page compiles it, unedited, to **eight ecosystems**, and shows the whole thing: the source values, the human judgment calls, and the coverage report grading every output. Nothing here is narrated where it can be shown. Every number and value below is produced by running `transtyle build` on [`examples/govuk/`](/docs/examples/).

<div class="callout"><div class="callout-title">Why GOV.UK</div>

It is deliberately unlike the invented examples: a flat, no-radius visual language, one brand color, an iconic yellow focus state, and a functional-colour set that names some roles the catalog expects and pointedly omits others. That last property is what makes it a real test — the gaps are where judgment lives.
</div>

## What GOV.UK actually publishes

The source is its real functional and web-palette colours, transcribed verbatim into `option.tokens.json`. These are the values, straight from [design-system.service.gov.uk](https://design-system.service.gov.uk/styles/colour/):

<div class="swatches">
  <div class="swatch"><i style="--c:#1d70b8" aria-hidden="true"></i><b>brand</b><span>#1d70b8</span></div>
  <div class="swatch"><i style="--c:#ca3535" aria-hidden="true"></i><b>error</b><span>#ca3535</span></div>
  <div class="swatch"><i style="--c:#0f7a52" aria-hidden="true"></i><b>success</b><span>#0f7a52</span></div>
  <div class="swatch"><i style="--c:#ffdd00" aria-hidden="true"></i><b>focus</b><span>#ffdd00</span></div>
  <div class="swatch"><i style="--c:#54319f" aria-hidden="true"></i><b>purple</b><span>#54319f</span></div>
  <div class="swatch"><i style="--c:#858686" aria-hidden="true"></i><b>black tint-50</b><span>#858686</span></div>
</div>

Plus the GDS Transport font stack and — importantly — **no border-radius at all**. GOV.UK components are flat by design; `radius.md` is authored to `0rem`, not left to a default.

## The binding: your names in, catalog meanings out

GOV.UK keeps its own vocabulary. One small [binding file](/docs/adopt-existing/) aliases the catalog's slots to GOV.UK's functional colours — nothing is renamed, and the catalog names never leak into GOV.UK's design language:

```json
"primary": { "solid": { "$value": "{semantic.color.govuk.brand}" } },
"danger":  { "solid": { "$value": "{semantic.color.govuk.error}" } },
"ring":    { "$value": "{semantic.color.govuk.focus}" },
"radius":  { "md": { "$value": "0rem" } }
```

From there, one value fans out to every target in that target's own dialect. The brand blue `#1d70b8`, as actually emitted:

| Target        | Emitted                                            |
| ------------- | -------------------------------------------------- |
| Bootstrap     | `$primary: #1d70b8;`                               |
| shadcn/ui     | `--primary: oklch(0.535 0.136 249.9);`             |
| CSS variables | `--color-primary-solid: oklch(0.535 0.136 249.9);` |

Same decision; sRGB hex where Bootstrap wants it, OKLCH where the modern targets want it. And the flat aesthetic survives translation — Bootstrap's `$border-radius`, `$border-radius-sm`, and `$border-radius-lg` all emit `0rem`.

## The judgment calls

A compiler shouldn't invent design decisions the source never made. Where GOV.UK names a role, the mapping is mechanical; where it doesn't, Transtyle either makes an **explicit, recorded choice** or leaves the slot to **derivation** — and says which. These are the real calls from this adoption:

<div class="jcalls">
  <div class="jcall clean">
    <div class="jc-slot"><span class="sw" style="--c:#ffdd00"></span>ring</div>
    <div class="jc-tag">clean 1:1</div>
    <div class="jc-body">GOV.UK's iconic yellow keyboard-focus outline (<code>#ffdd00</code>) is exactly what the <code>ring</code> slot exists for. The best mapping in the whole adoption — no interpretation needed.</div>
  </div>
  <div class="jcall chose">
    <div class="jc-slot"><span class="sw" style="--c:#858686"></span>neutral.solid</div>
    <div class="jc-tag">chose · recorded</div>
    <div class="jc-body">GOV.UK has no "neutral brand" colour. Bound to Black tint-50 (<code>#858686</code>), the closest authored gray. A different reasonable choice existed (tint-25, <code>#484949</code>); the reason for this one is in the token's <code>$description</code>.</div>
  </div>
  <div class="jcall chose">
    <div class="jc-slot"><span class="sw" style="--c:#54319f"></span>link.visited</div>
    <div class="jc-tag">chose · recorded</div>
    <div class="jc-body">Not in GOV.UK's functional set at all. Bound to the web-palette purple, matching the historical GOV.UK-frontend convention — a real GOV.UK colour, just not exposed at this granularity.</div>
  </div>
  <div class="jcall derived">
    <div class="jc-slot"><span class="sw" style="--c:#daa932"></span>warning.solid</div>
    <div class="jc-tag">left to derivation</div>
    <div class="jc-body">GOV.UK names no warning colour, so the slot is left unbound. The standard rule hue-anchors it to 85° → <code>#daa932</code>, a defensible amber — coherent with the brand, but honestly not GOV.UK's own choice, because GOV.UK hasn't made one.</div>
  </div>
  <div class="jcall derived">
    <div class="jc-slot"><span class="sw" style="--c:#657d96"></span>secondary.solid</div>
    <div class="jc-tag">left to derivation</div>
    <div class="jc-body">Unbound. <code>desaturate-primary</code> pulls the brand blue toward gray → <code>#657d96</code>. Bind it the day GOV.UK defines a secondary; until then, derivation tracks the brand automatically.</div>
  </div>
  <div class="jcall derived">
    <div class="jc-slot"><span class="sw" style="--c:#1d70b8"></span>accent.solid</div>
    <div class="jc-tag">left to derivation</div>
    <div class="jc-body">Unbound. The rule aliases it straight to <code>primary.solid</code> → the brand blue. A safe default when the source draws no accent/primary distinction.</div>
  </div>
</div>

Every one of these is inspectable after the fact — `npx transtyle explain warning.solid` prints the full rule and inputs, so a reviewer can audit each choice without reading code.

## The coverage, unretouched

Eight targets build with **zero diagnostics** — no contrast failures against WCAG 2.1 AA, no dangling aliases. But zero-diagnostics is not the same as lossless, and the report says so per target. This is the real split from `report.json` for each build:

<div class="covmatrix">
  <div class="cm-row"><span class="cm-name">css-variables</span><span class="cm-bar"><span class="cm-seg native" style="width:100%"></span></span></div>
  <div class="cm-row"><span class="cm-name">primeng</span><span class="cm-bar"><span class="cm-seg native" style="width:69%"></span><span class="cm-seg derived" style="width:19%"></span><span class="cm-seg approx" style="width:3%"></span><span class="cm-seg other" style="width:9%"></span></span></div>
  <div class="cm-row"><span class="cm-name">storybook</span><span class="cm-bar"><span class="cm-seg native" style="width:61%"></span><span class="cm-seg derived" style="width:16%"></span><span class="cm-seg approx" style="width:13%"></span><span class="cm-seg other" style="width:10%"></span></span></div>
  <div class="cm-row"><span class="cm-name">shadcn</span><span class="cm-bar"><span class="cm-seg native" style="width:50%"></span><span class="cm-seg derived" style="width:47%"></span><span class="cm-seg approx" style="width:3%"></span></span></div>
  <div class="cm-row"><span class="cm-name">echarts</span><span class="cm-bar"><span class="cm-seg native" style="width:50%"></span><span class="cm-seg derived" style="width:20%"></span><span class="cm-seg approx" style="width:20%"></span><span class="cm-seg other" style="width:10%"></span></span></div>
  <div class="cm-row"><span class="cm-name">radix</span><span class="cm-bar"><span class="cm-seg native" style="width:42%"></span><span class="cm-seg approx" style="width:58%"></span></span></div>
  <div class="cm-row"><span class="cm-name">daisyui</span><span class="cm-bar"><span class="cm-seg native" style="width:32%"></span><span class="cm-seg derived" style="width:55%"></span><span class="cm-seg approx" style="width:9%"></span><span class="cm-seg other" style="width:5%"></span></span></div>
  <div class="cm-row"><span class="cm-name">bootstrap</span><span class="cm-bar"><span class="cm-seg native" style="width:2%"></span><span class="cm-seg derived" style="width:76%"></span><span class="cm-seg approx" style="width:5%"></span><span class="cm-seg other" style="width:18%"></span></span></div>
</div>

<p class="covmatrix-legend"><span><i class="native"></i>native — lossless</span><span><i class="derived"></i>derived — computed from GOV.UK's values</span><span><i class="approx"></i>approximated — meaning bent, reason recorded</span><span><i class="other"></i>dropped / unsupported — this target can't say it</span></p>

Read the shape, not a single number. `css-variables` is 100% native because it is the conformance dump — it has a slot for everything. `radix` is 58% approximated because its 12-step alpha ramps are a _fixed_ projection, not a colorimetric reconstruction of Radix's real per-colour alpha — honest about the compromise rather than hiding it. `bootstrap` is 76% derived across 712 classified rows because GOV.UK authored a handful of colours and the standard rules coherently filled Bootstrap's large variable surface from them — a low `native` share on that target means "few of its variables take an authored value verbatim", not "poorly themed".

## The honesty is in the notes

The grey slice above — dropped and unsupported — is where a lesser tool would fake a value. Transtyle omits it, with a reason attached. These are real `note` fields from the reports:

| Target    | Item                        | Grade        | The note                                                                         |
| --------- | --------------------------- | ------------ | -------------------------------------------------------------------------------- |
| bootstrap | `$box-shadow-inset`         | unsupported  | no IR inset-shadow concept; Bootstrap default kept                               |
| bootstrap | `$transition-*` (motion)    | dropped      | Bootstrap themes almost none of it                                               |
| echarts   | candlestick / gauge series  | unsupported  | beyond catalog semantics; extend the emitted theme manually                      |
| radix     | `--primary-a1` (alpha ramp) | approximated | fixed alpha ramp, not a colorimetric derivation of Radix's real per-colour alpha |
| primeng   | structural components       | unsupported  | no severity-coloured surface; inherits Aura's own default untouched              |

## Scope, stated plainly

Two things are deliberately _not_ done, because doing them would mean inventing what GOV.UK never specified — and saying so is part of the honesty:

- **No dark mode.** GOV.UK publishes no dark theme; the config declares only `light`. A single-mode config is fully legal and every target handles it without special-casing.
- **The type scale is left to catalog defaults.** GOV.UK's responsive 16–80px scale doesn't map onto the catalog's fixed steps without distorting one or the other; a production adopter would bind it properly. Out of scope for demonstrating the _pattern_.
- **The real GDS Transport typeface** is licensed to crown services only; the tokens name GOV.UK's own public fallback stack (`GDS Transport, arial, sans-serif`), exactly as GOV.UK's own CSS resolves for non-crown consumers.

## See it running

Every target ships a [demo project](/docs/examples/) that renders this theme on the framework's real components, consuming only the compiled `dist/`:

```bash
npm run dev -w govuk-demo-bootstrap    # GOV.UK's flat aesthetic on real Bootstrap
npm run dev -w govuk-demo-shadcn       # the same page, real shadcn/ui components
```

## The takeaway

GOV.UK compiled to eight ecosystems with **zero catalog amendments** and zero diagnostics — evidence the [role grid](/docs/language/) generalizes past the systems it was designed against. The mechanical mappings were free; the judgment calls were few, explicit, and recorded; and every compromise is a number you can inspect. That is the whole product: [the coverage report is the trust mechanism](/docs/concepts/#5-provenance-and-coverage), not marketing around it.

Do it for your own system next: [You already have a design system](/docs/adopt-existing/).
