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

This page is the full pivot vocabulary as implemented today — <span class="badge live">compiled</span> unless marked <span class="badge spec">specced</span> (exists in the [IR specification](/docs/internals/), not yet compiled). Swatches show real derived values from the [Acme example](/docs/examples/)'s single blue brand color.

## Color roles

Eight roles; each is a **scale**, because targets need states, not single values:

| Scale position | Meaning | If unauthored, derived by |
|---|---|---|
| `<role>.base` | The role's principal value | per-role rule below |
| `<role>.hover` / `.active` | Interaction states | lightness deltas, direction flips in dark mode |
| `<role>.subtle` | Tinted background version | mix toward `surface` (92%) |
| `<role>.contrast` | Max-contrast counterpart | contrast-anchor(text) |

| Role | Meaning | Base derivation when unauthored | e.g. (from a blue brand) |
|---|---|---|---|
| `primary` | The action/brand color | **must be authored** — the one non-negotiable input | <span class="sw" style="--c:oklch(0.55 0.18 255)"></span> |
| `secondary` | Second brand color | desaturated primary | <span class="sw" style="--c:oklch(0.58 0.063 255)"></span> |
| `accent` | Emphasis/highlight | alias of primary | <span class="sw" style="--c:oklch(0.55 0.18 255)"></span> |
| `success` / `warning` / `danger` / `info` | Status colors | fixed hue anchors (150/85/25/230), brand-matched chroma | <span class="sw" style="--c:oklch(0.6 0.14 150)"></span><span class="sw" style="--c:oklch(0.76 0.14 85)"></span><span class="sw" style="--c:oklch(0.55 0.19 25)"></span><span class="sw" style="--c:oklch(0.58 0.15 230)"></span> |
| `neutral` | The gray family | brand-hued near-gray | <span class="sw" style="--c:oklch(0.55 0.012 255)"></span> |

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
| `palette.categorical.1–8` | Data-viz series colors <span class="sw" style="--c:#026fd7"></span><span class="sw" style="--c:#d15c56"></span><span class="sw" style="--c:#319751"></span><span class="sw" style="--c:#d4a73e"></span><span class="sw" style="--c:#975ac0"></span><span class="sw" style="--c:#00a6ae"></span><span class="sw" style="--c:#d779ba"></span><span class="sw" style="--c:#7e8814"></span> | hue rotation from primary, distinguishability-banded; entries 1–5 frozen (cross-target contract) |
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

## Coming: the role grid

<span class="badge spec">specced</span> — accepted, not yet compiled. The five-position scale above (`base/hover/active/subtle/contrast`) turns out to be a sparse sample of something every mature design system independently arrives at: a **two-axis grid** — how prominent a color is (`solid` fill → `tint` wash → `outline` → `text`) crossed with interaction state (`rest → hover → active → selected`), plus on-colors for the two surface-like columns. Radix's 12 steps, Ant Design's map tokens, Bootstrap's subtle triad, Chakra's `colorPalette`, and Material 3's container/`on-*` pairs are all differently-named samples of this same grid — which is exactly why exporters kept inventing private conventions for cells the old scale had no name for (Bootstrap's border tints, `-text-emphasis` semantics, Storybook's `Selected` chrome).

```
prominence →   solid            tint            outline          text
rest           solid            tint            outline          text
hover          solid-hover      tint-hover      outline-hover    text-hover
active         solid-active     tint-active     —                text-active
on-colors      on-solid         on-tint         —                —
strong         —                —               —                text-strong
```

Every v0 slot maps onto the grid directly: `<role>.base` → `<role>.solid`, `<role>.subtle` → `<role>.tint`, `text-on-<role>.base` → `<role>.on-solid`, `<role>.contrast` → `<role>.text-strong`. The old surface slots (`background`, `surface`, `surface-raised`, `overlay`) become an explicit **elevation ladder** (`elevation.0..5.surface`), and content gets a real hierarchy (`text.{strong,base,muted,subtle,disabled,inverse}`) instead of two slots.

This is a **breaking revision, not a new version** — Transtyle is unreleased, so there's no compatibility to preserve and no "v1" to bump to; the IR spec stays v0 throughout (`docs/adr/0010-pre-release-breaking-changes.md`). Full derivation: `docs/architecture/ir.md`; the comparative study and per-ecosystem conversion tables behind it: `docs/proposals/0001-universal-token-ir.md`; the sequenced implementation plan: `docs/plan/catalog-revision.md`.

**Extended false friends** (the grid makes more of these precise):

| Word | In the catalog | In shadcn | In Radix | In Chakra |
|---|---|---|---|---|
| **outline** | `<role>.outline` — a border-only wash, one prominence step below `solid` | not a slot (Tailwind `border` utility on `--border`) | steps 7/8 | not distinguished from `subtle` |
| **subtle / muted / emphasized** | `<role>.tint` (one wash, all states) | `muted` = a surface+foreground pair | steps 3–5 (a *range*, not one value) | three distinct depths: `subtle`, `muted`, `emphasized` |
| **selected** | `<role>.solid-selected` / `tint-selected` (aliases of `-active` unless authored) | not a concept | not a concept | not a concept |

## How the language grows

The catalog is deliberately fixed per version — it's the compiler's instruction set. Growth is evidence-driven: when exporters repeatedly report a target slot as `unsupported` (shadcn's `--input` is the current watch item), that's the data that justifies a new catalog slot. Pre-release, revisions like the role grid above can still change the catalog in place; once Transtyle publishes, growth becomes additive-only — nothing removed or re-typed within a major. Your token files outlive our versions.
