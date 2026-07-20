---
title: "Overview"
description: "What Transtyle is, why it exists, and the mental model."
order: 1
---

# A compiler for design systems

Transtyle takes a framework-agnostic description of your design system — tokens, semantics, modes — and compiles it into **native, ready-to-use theme artifacts** for many ecosystems: shadcn/ui, daisyUI, Apache ECharts, Bootstrap and Storybook today; more per the roadmap.

Describe your design system once. Change it in one place. Regenerate every target.

```bash
cd examples/acme
npx transtyle build shadcn
# → dist/shadcn/globals.transtyle.css  (complete shadcn theme, light + dark)
# → dist/shadcn/report.json            (coverage + provenance for every value)
```

## Why another token tool?

Existing token pipelines (Style Dictionary, Terrazzo) transform token files into *variables*. Transtyle understands what your design system *means* — that `danger` maps to shadcn's `--destructive`, that a subtle background needs its own readable foreground, that a data-viz palette must be derived from your brand, not copy-pasted — and produces configuration a framework practitioner would recognize as idiomatic.

| Principle | What it means for you |
|---|---|
| **DTCG superset** | Your token files are valid W3C Design Tokens. Figma, Tokens Studio, Style Dictionary can read them. No lock-in. |
| **Deterministic derivation** | Missing tokens (hover states, on-colors, a secondary color) are filled by inspectable rules — never magic. Authored values always win. |
| **Honest lossiness** | Every build reports what mapped natively, what was derived, what was approximated, what was dropped — per variable. |
| **Native output** | You get a `globals.css` a shadcn user would write, not a pile of generic variables. Generated files are disposable: regenerate, never edit. |
| **No runtime** | Transtyle ships nothing into your app. Files out, nothing in. |

## The mental model

```
frontends (importers)      intermediate representation      backends (exporters)
─────────────────────      ──────────────────────────       ────────────────────
DTCG token files      ──→  normalized, derived,        ──→  shadcn/ui, daisyUI, ECharts,
Figma, Tailwind (soon)     validated token graph            Bootstrap, Storybook
```

Like Babel or LLVM: one intermediate representation in the middle, pluggable frontends and backends on either side. That architecture is why ecosystem-to-ecosystem translation (Bootstrap → shadcn) will be a composition of existing parts, not a special feature.

## If you run a design system, this is for you

In your vocabulary: **option tokens** are your primitives, **semantic tokens** are your alias/decision layer, and the catalog is a *published interface* over that decision layer which frameworks plug into. You keep your names, your Figma sync, your governance; Transtyle compiles the decision layer outward — and reports, per variable, what was your decision (`authored`), what was inferred from it (`derived`), and what got bent in translation (`approximated`).

Seeing is believing. From **one authored brand color** <span class="sw" style="--c:oklch(0.55 0.18 255)"></span> `oklch(0.55 0.18 255)`, the standard rules derive the full role set:

<div class="pal"><span style="--c:oklch(0.55 0.18 255)" data-l="primary"></span><span style="--c:oklch(0.58 0.063 255)" data-l="secondary"></span><span style="--c:oklch(0.95 0.017 255)" data-l="accent·subtle"></span><span style="--c:oklch(0.55 0.19 25)" data-l="danger"></span><span style="--c:oklch(0.76 0.14 85)" data-l="warning"></span><span style="--c:oklch(0.6 0.14 150)" data-l="success"></span><span style="--c:oklch(0.58 0.15 230)" data-l="info"></span><span style="--c:oklch(0.55 0.012 255)" data-l="neutral"></span></div>

…and an 8-color categorical data-viz palette, hue-rotated from the brand, shared verbatim between shadcn's `--chart-*` and ECharts' `color[]`:

<div class="pal"><span style="--c:#026fd7" data-l="1"></span><span style="--c:#d15c56" data-l="2"></span><span style="--c:#319751" data-l="3"></span><span style="--c:#d4a73e" data-l="4"></span><span style="--c:#975ac0" data-l="5"></span><span style="--c:#00a6ae" data-l="6"></span><span style="--c:#d779ba" data-l="7"></span><span style="--c:#7e8814" data-l="8"></span></div>

Every one of these is deterministic, provenance-tagged, contrast-checked where it pairs with text, and overridable by authoring one token. Nothing here is a mockup — these are the compiled values from the [Acme example](/docs/examples/).

## Minimal input, complete output

The [Acme example](/docs/examples/) authors **11 tokens** — one brand color, neutrals, a radius, two fonts — and compiles to the complete 33-variable shadcn theme with hover states, subtle tints, contrast-checked on-colors, dark mode, and a brand-derived categorical chart palette — plus, from the same tokens, per-mode Apache ECharts themes. Every generated value knows where it came from.

The [Cathode example](/docs/examples/#cathode-the-hostile-example) proves the opposite direction: a design system with completely alien vocabulary (`crt.ink`, `crt.tube`, `crt.meltdown`), dark-native, brand-color-as-text-color — compiled through the same catalog via one-line bindings.

> **Status honesty:** Transtyle is a v0.1 walking skeleton. The pipeline, derivation engine, mode system, and shadcn exporter work end-to-end and deterministically. Many specced features (more exporters, `init`, `explain`, `diff`, importers) are design-complete but not implemented. The [roadmap](/docs/roadmap/) tells the truth about which is which.

Start with [Getting started](/docs/getting-started/) for a greenfield project — or, for the most common case, [You already have a design system](/docs/adopt-existing/): map your existing vocabulary onto [the Transtyle language](/docs/language/) without renaming anything.
