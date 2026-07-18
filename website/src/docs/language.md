---
title: "The Transtyle language"
description: "The semantic catalog as an interlingua: every slot, how values enter it (aliases or derivation), and how they exit to each target."
order: 4
---

# The Transtyle language

Machine translation between many languages doesn't build a translator per pair — it translates through a pivot language, an *interlingua*. Transtyle's semantic catalog is exactly that. Your design system's semantics map **into** the catalog (manually via aliases, or automatically via derivation); each target library's semantics map **out of** it (via each exporter's mapping table). N design systems × M libraries, through one vocabulary.

```
your semantics            the catalog (pivot)           each library's semantics
──────────────            ───────────────────           ────────────────────────
"brand-action"   ─alias→  primary.base         ─table→  --primary (shadcn)
"flame-soft"     ─alias→  primary.subtle       ─table→  color[0] (ECharts)
(nothing)        ─rule──→ text-on-primary.base ─table→  --primary-foreground
```

This page is the full pivot vocabulary as implemented today. Slots marked *specced* exist in the [IR specification](/docs/internals/) but are not yet compiled.

## Color roles

Eight roles; each is a **scale**, because targets need states, not single values:

| Scale position | Meaning | If unauthored, derived by |
|---|---|---|
| `<role>.base` | The role's principal value | per-role rule below |
| `<role>.hover` / `.active` | Interaction states | lightness deltas, direction flips in dark mode |
| `<role>.subtle` | Tinted background version | mix toward `surface` (92%) |
| `<role>.contrast` | Max-contrast counterpart | contrast-pick *(specced)* |

| Role | Meaning | Base derivation when unauthored |
|---|---|---|
| `primary` | The action/brand color | **must be authored** — the one non-negotiable input |
| `secondary` | Second brand color | desaturated primary |
| `accent` | Emphasis/highlight | alias of primary |
| `success` / `warning` / `danger` / `info` | Status colors | fixed hue anchors (150/85/25/230), brand-matched chroma |
| `neutral` | The gray family | brand-hued near-gray |

## Surfaces, content, and the rest

| Slot | Meaning | Derivation |
|---|---|---|
| `background` | The page | author it (falls back derived from nothing well) |
| `surface` | Cards, panels | author it |
| `surface-raised` | Elevated layer | raise(`surface`) |
| `overlay` | Floating layers: popover, menu, dialog | alias of `surface-raised` |
| `scrim` | Dimming veil behind modals | near-black at fixed alpha |
| `text` / `text-muted` | Content colors | author them |
| `text-on-<role>.base` / `.subtle` | Readable foreground on a role's base / tinted background | contrast-pick, AA-checked, warning if impossible |
| `border` / `ring` | Lines and focus | author border; ring ← primary, lightened in dark |
| `palette.categorical.1–8` | Data-viz series colors | hue rotation from primary, distinguishability-banded |
| `radius.md`, `font.sans`, `font.mono` | Shape and type | author them |
| spacing, shadows, motion, z-index, type scales | — | *specced*, not yet compiled |

Anything else you define under `semantic.*` is a **custom semantic token** — legal, carried, mode-aware, and the recommended home for your own vocabulary ([adoption guide](/docs/adopt-existing/), step 2).

## False friends

The reason a pivot language must exist: the same word means different things across ecosystems, and Transtyle's job is to translate *meanings*, never names.

| Word | In the catalog | In shadcn | In Bootstrap |
|---|---|---|---|
| **secondary** | second *brand* color | subtle gray button surface (`--secondary` ← our `neutral.subtle`) | a theme color (≈ ours) |
| **accent** | brand emphasis color | hover-highlight tint (`--accent` ← our `accent.subtle`) | not a concept |
| **muted** | not a slot (see `text-muted`, `neutral.subtle`) | a surface *and* a foreground pair | text utility |

Exporter mapping tables encode these translations once, reviewed by people who know both languages — that's why exporters bind to the catalog and never to your names, and why you should bind your names by meaning, not spelling.

## How the language grows

The catalog is deliberately fixed per version — it's the compiler's instruction set. Growth is evidence-driven: when exporters repeatedly report a target slot as `unsupported` (shadcn's `--input` is the current watch item), that's the data that justifies a new catalog slot in a minor IR revision. Additive only; nothing is removed or re-typed within a major. Your token files outlive our versions.
