---
title: "Overview"
description: "What Transtyle is, why it exists, and the mental model."
order: 1
---

# A compiler for design systems

Transtyle takes a framework-agnostic description of your design system — tokens, semantics, modes — and compiles it into **native, ready-to-use theme artifacts**. Eight targets ship today: shadcn/ui, daisyUI, Apache ECharts, Bootstrap, Storybook, Radix Themes, PrimeNG, and plain CSS variables.

Describe your design system once. Change it in one place. Regenerate every target.

<div class="flow" role="img" aria-label="Pipeline: DTCG token files flow into the intermediate representation (normalize, derive, validate), which flows out to eight target exporters">
  <span class="fgroup"><span class="fnode">DTCG token files</span><span class="fnode dim">Figma · Tailwind (specced)</span></span>
  <span class="farr">→</span>
  <span class="fnode hi">IR: normalize · derive · validate</span>
  <span class="farr">→</span>
  <span class="fgroup"><span class="fnode">shadcn · daisyUI · ECharts · Bootstrap</span><span class="fnode">Storybook · Radix · PrimeNG · css-variables</span></span>
</div>

```bash
cd examples/acme
npx transtyle build
# → dist/shadcn/globals.transtyle.css       (complete shadcn theme, light + dark)
# → dist/bootstrap/_variables.transtyle.scss (idiomatic Bootstrap Sass)
# → dist/echarts/theme.acme-light.json       (chart theme, derived palette)
# → …one directory per configured target, each with usage.md + report.json
```

## Three ways in

<div class="paths">
  <a href="/docs/adopt-existing/">
    <span class="path-kicker">Most common</span>
    <span class="path-title">You already have a design system</span>
    <span class="path-desc">Keep your names and values. Bind them to the catalog with one-line aliases; nothing gets renamed.</span>
  </a>
  <a href="/docs/getting-started/">
    <span class="path-kicker">Greenfield</span>
    <span class="path-title">Start from a brand color</span>
    <span class="path-desc"><code>transtyle init</code> scaffolds a project; author a handful of decisions and derivation fills the rest.</span>
  </a>
  <a href="/docs/internals/">
    <span class="path-kicker">Extend</span>
    <span class="path-title">Write an exporter</span>
    <span class="path-desc">All eight official exporters use the same public plugin API — the core knows nothing about any target.</span>
  </a>
</div>

## Why another token tool?

Existing token pipelines (Style Dictionary, Terrazzo) transform token files into *variables*. Transtyle understands what your design system *means* — that `danger` maps to shadcn's `--destructive` and daisyUI's `--color-error`, that a subtle background needs its own readable foreground, that a data-viz palette must be derived from your brand, not copy-pasted — and produces configuration a framework practitioner would recognize as idiomatic.

| Principle | What it means for you |
|---|---|
| **DTCG superset** | Your token files are valid W3C Design Tokens. Figma, Tokens Studio, Style Dictionary can read them. No lock-in. |
| **Deterministic derivation** | Missing tokens (hover states, on-colors, a secondary color) are filled by inspectable rules — never magic. Authored values always win. |
| **Honest lossiness** | Every build reports what mapped natively, what was derived, what was approximated, what was dropped — per variable. |
| **Native output** | You get a `globals.css` a shadcn user would write, not a pile of generic variables. Generated files are disposable: regenerate, never edit. |
| **No runtime** | Transtyle ships nothing into your app. Files out, nothing in. |

## If you run a design system, this is for you

In your vocabulary: **option tokens** are your primitives, **semantic tokens** are your alias/decision layer, and the catalog is a *published interface* over that decision layer which frameworks plug into. You keep your names, your Figma sync, your governance; Transtyle compiles the decision layer outward — and reports, per variable, what was your decision (<span class="prov authored">authored</span>), what was inferred from it (<span class="prov derived">derived</span>), and what got bent in translation (<span class="prov approx">approximated</span>).

Seeing is believing. From **one authored brand color** <span class="sw" style="--c:oklch(0.55 0.18 255)"></span> `oklch(0.55 0.18 255)`, the standard rules derive the full role set:

<div class="pal"><span style="--c:oklch(0.55 0.18 255)" data-l="primary"></span><span style="--c:oklch(0.58 0.063 255)" data-l="secondary"></span><span style="--c:oklch(0.95 0.017 255)" data-l="accent·tint"></span><span style="--c:oklch(0.55 0.19 25)" data-l="danger"></span><span style="--c:oklch(0.76 0.14 85)" data-l="warning"></span><span style="--c:oklch(0.6 0.14 150)" data-l="success"></span><span style="--c:oklch(0.58 0.15 230)" data-l="info"></span><span style="--c:oklch(0.55 0.012 255)" data-l="neutral"></span></div>

…and an 8-color categorical data-viz palette, hue-rotated from the brand, shared verbatim between shadcn's `--chart-*` and ECharts' `color[]`:

<div class="pal"><span style="--c:#026fd7" data-l="1"></span><span style="--c:#d15c56" data-l="2"></span><span style="--c:#319751" data-l="3"></span><span style="--c:#d4a73e" data-l="4"></span><span style="--c:#975ac0" data-l="5"></span><span style="--c:#00a6ae" data-l="6"></span><span style="--c:#d779ba" data-l="7"></span><span style="--c:#7e8814" data-l="8"></span></div>

Every one of these is deterministic, provenance-tagged, contrast-checked where it pairs with text, and overridable by authoring one token. Nothing here is a mockup — these are the compiled values from the [Acme example](/docs/examples/), and `npx transtyle explain` will show you each one's derivation chain.

## Proof it generalizes

The [Acme example](/docs/examples/) authors **11 tokens** and compiles complete themes for all eight targets. [Cathode](/docs/examples/#cathode--the-hostile-example) proves the hostile direction: alien vocabulary (`crt.ink`, `crt.tube`), dark-native, bound through the same catalog with one-line aliases. And two **real, independently-designed systems** — [GOV.UK and IBM Carbon](/docs/examples/) — compile to every target with zero diagnostics, using only their published values.

> **Status honesty:** Transtyle is pre-publication (v0, not yet on npm — you run it from the repository). What's real today: the full pipeline, the derivation engine (role grids, elevation, scales, modes), `build` / `check` / `explain` / `init` / `add`, eight exporters, four examples with runnable demo projects for every target, and CI-verified deterministic builds. What's specced but not implemented: `diff`, `import`, `preview`, and the importers. The [roadmap](/docs/roadmap/) tells the truth about which is which.

Start with the path card above that matches your situation — or read [Core concepts](/docs/concepts/) first if you want the mental model before touching files: three token tiers, [the catalog as pivot language](/docs/language/), modes, and the provenance/coverage trust system.
