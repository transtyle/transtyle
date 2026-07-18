---
title: "Overview"
description: "What Transtyle is, why it exists, and the mental model."
order: 1
---

# A compiler for design systems

Transtyle takes a framework-agnostic description of your design system — tokens, semantics, modes — and compiles it into **native, ready-to-use theme artifacts** for many ecosystems: shadcn/ui and Apache ECharts today; Bootstrap, Storybook and more per the roadmap.

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
DTCG token files      ──→  normalized, derived,        ──→  shadcn/ui, ECharts (today)
Figma, Tailwind (soon)     validated token graph            Bootstrap, Storybook (specced)
```

Like Babel or LLVM: one intermediate representation in the middle, pluggable frontends and backends on either side. That architecture is why ecosystem-to-ecosystem translation (Bootstrap → shadcn) will be a composition of existing parts, not a special feature.

## Minimal input, complete output

The [Acme example](/docs/examples/) authors **11 tokens** — one brand color, neutrals, a radius, two fonts — and compiles to the complete 33-variable shadcn theme with hover states, subtle tints, contrast-checked on-colors, dark mode, and a brand-derived categorical chart palette — plus, from the same tokens, per-mode Apache ECharts themes. Every generated value knows where it came from.

The [Cathode example](/docs/examples/#cathode-the-hostile-example) proves the opposite direction: a design system with completely alien vocabulary (`crt.ink`, `crt.tube`, `crt.meltdown`), dark-native, brand-color-as-text-color — compiled through the same catalog via one-line bindings.

> **Status honesty:** Transtyle is a v0.1 walking skeleton. The pipeline, derivation engine, mode system, and shadcn exporter work end-to-end and deterministically. Many specced features (more exporters, `init`, `explain`, `diff`, importers) are design-complete but not implemented. The [roadmap](/docs/roadmap/) tells the truth about which is which.

Start with [Getting started](/docs/getting-started/), or read [Core concepts](/docs/concepts/) first if you like to know what you're typing.
