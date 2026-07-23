---
title: 'The Transtyle language'
description: 'The semantic catalog as an interlingua: every slot, how values enter it (aliases or derivation), and how they exit to each target.'
order: 4
---

# The Transtyle language

Machine translation between many languages doesn't build a translator per pair — it translates through a pivot language, an _interlingua_. Transtyle's semantic catalog is exactly that. Your design system's semantics map **into** the catalog (manually via aliases, or automatically via derivation); each target library's semantics map **out of** it (via each exporter's mapping table). N design systems × M libraries, through one vocabulary.

```
your semantics            the catalog (pivot)          each library's semantics
──────────────            ───────────────────           ────────────────────────
"brand-action"   ─alias→  primary.solid        ─table→  --primary (shadcn)
"flame-soft"     ─alias→  primary.tint         ─table→  color[0] (ECharts)
(nothing)        ─rule──→ primary.on-solid     ─table→  --primary-foreground
```

This page is the full pivot vocabulary as implemented today — <span class="badge live">compiled</span> unless marked <span class="badge spec">specced</span> (exists in the [IR specification](/docs/internals/), not yet compiled). Swatches show real derived values from the [Acme example](/docs/examples/)'s single blue brand color.

## Color roles: the role grid

Eight roles; each is a **grid**, not a flat scale, because every mature design system independently arrives at the same two axes: how prominent a color is (`solid` fill → `tint` wash → `outline` → `text`) crossed with interaction state (`rest → hover → active → selected`), plus the paired foregrounds for the two surface-like columns. Radix's 12 steps, Ant Design's map tokens, Bootstrap's subtle triad, Chakra's `colorPalette`, and Material 3's container/`on-*` pairs are all differently-named samples of this same grid.

```
prominence →   solid            tint            outline          text
rest           solid            tint            outline          text
hover          solid-hover      tint-hover      outline-hover    text-hover
active         solid-active     tint-active     —                text-active
selected       solid-selected   tint-selected   —                —
on-colors      on-solid         on-tint         —                —
strong         —                —               —                text-strong
```

| Grid cell                                          | Meaning                                                  | If unauthored, derived by                                                                  |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `<role>.solid`                                     | The role's principal value                               | per-role rule below                                                                        |
| `<role>.solid-hover` / `-active` / `-selected`     | Interaction states on the solid fill                     | lightness deltas from `solid`, direction flips in dark mode; `-selected` aliases `-active` |
| `<role>.tint` / `-hover` / `-active` / `-selected` | Tinted background wash                                   | mix toward `elevation.1.surface` (92% / 88% / 84%)                                         |
| `<role>.outline` / `-hover`                        | Border-only wash, one step below `solid`                 | mix toward `elevation.1.surface` (70% / 55%)                                               |
| `<role>.on-solid`                                  | Readable foreground on `solid`                           | contrast-pick white/near-black, AA-checked, warning if impossible                          |
| `<role>.on-tint`                                   | Readable foreground on `tint`                            | on-brand walk from `solid-active` until AA clears                                          |
| `<role>.text` / `-hover` / `-active`               | A role-colored, AA-safe text/link color against the page | on-brand walk against `elevation.0.surface`                                                |
| `<role>.text-strong`                               | Max-contrast counterpart                                 | contrast-anchor(text)                                                                      |

| Role                                      | Meaning                | `solid` derivation when unauthored                      | e.g. (from a blue brand)                                                                                                                                                                                                          |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`                                 | The action/brand color | **must be authored** — the one non-negotiable input     | <span class="sw" style="--c:oklch(0.55 0.18 255)"></span>                                                                                                                                                                         |
| `secondary`                               | Second brand color     | desaturated primary                                     | <span class="sw" style="--c:oklch(0.58 0.063 255)"></span>                                                                                                                                                                        |
| `accent`                                  | Emphasis/highlight     | alias of primary                                        | <span class="sw" style="--c:oklch(0.55 0.18 255)"></span>                                                                                                                                                                         |
| `success` / `warning` / `danger` / `info` | Status colors          | fixed hue anchors (150/85/25/230), brand-matched chroma | <span class="sw" style="--c:oklch(0.6 0.14 150)"></span><span class="sw" style="--c:oklch(0.76 0.14 85)"></span><span class="sw" style="--c:oklch(0.55 0.19 25)"></span><span class="sw" style="--c:oklch(0.58 0.15 230)"></span> |
| `neutral`                                 | The gray family        | brand-hued near-gray                                    | <span class="sw" style="--c:oklch(0.55 0.012 255)"></span>                                                                                                                                                                        |

## Elevation, content, and the rest

Surfaces are an **elevation ladder**, not four separate named slots — each level projects a surface color, and levels 1–4 pair with a shadow:

| Slot                                                                                                                                 | Meaning                                                                                                                                                                                                                                                                                                                                                                                 | Derivation                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `elevation.0.surface`                                                                                                                | The page                                                                                                                                                                                                                                                                                                                                                                                | author it                                                                                                                            |
| `elevation.1.surface`                                                                                                                | Cards, panels                                                                                                                                                                                                                                                                                                                                                                           | author it (falls back to level 0)                                                                                                    |
| `elevation.2.surface`                                                                                                                | Raised layer                                                                                                                                                                                                                                                                                                                                                                            | raise(level 1)                                                                                                                       |
| `elevation.3.surface`                                                                                                                | Floating layers: popover, menu, dialog                                                                                                                                                                                                                                                                                                                                                  | raise(level 2) — deliberately one step further than a merely-raised card                                                             |
| `elevation.4.surface` / `elevation.5.surface`                                                                                        | Deeper stacking contexts                                                                                                                                                                                                                                                                                                                                                                | raise(previous level)                                                                                                                |
| `elevation.1..4.shadow`                                                                                                              | Paired shadow per level                                                                                                                                                                                                                                                                                                                                                                 | composed from `scrim` at fixed alpha ramps                                                                                           |
| `scrim`                                                                                                                              | Dimming veil behind modals                                                                                                                                                                                                                                                                                                                                                              | near-black at fixed alpha — a veil, not an elevation level                                                                           |
| `text.base` / `text.muted` / `text.subtle` / `text.disabled` / `text.strong` / `text.inverse`                                        | Content hierarchy                                                                                                                                                                                                                                                                                                                                                                       | author `text.base`; the rest derive from it (`.strong` aliases `neutral.text-strong`; `.inverse` reads the other mode's `text.base`) |
| `link.base` / `.hover` / `.visited`                                                                                                  | Link colors                                                                                                                                                                                                                                                                                                                                                                             | alias of `primary.text` and its states, hue-shifted for visited                                                                      |
| `border` / `ring`                                                                                                                    | Lines and focus                                                                                                                                                                                                                                                                                                                                                                         | author `border`; `ring` ← primary, lightened in dark                                                                                 |
| `palette.categorical.1–8`                                                                                                            | Data-viz series colors <span class="sw" style="--c:#026fd7"></span><span class="sw" style="--c:#d15c56"></span><span class="sw" style="--c:#319751"></span><span class="sw" style="--c:#d4a73e"></span><span class="sw" style="--c:#975ac0"></span><span class="sw" style="--c:#00a6ae"></span><span class="sw" style="--c:#d779ba"></span><span class="sw" style="--c:#7e8814"></span> | hue rotation from primary, distinguishability-banded; entries 1–5 frozen (cross-target contract)                                     |
| `radius.md` (+ `control`/`field`/`container` aliases), `font.sans`, `font.mono`                                                      | Shape and type                                                                                                                                                                                                                                                                                                                                                                          | author them                                                                                                                          |
| `space.*`, `size.control.*`, `border-width.*`, `breakpoint.*`, `z.*`, `type.*` (+ composite `type.role.*`), `duration.*`, `easing.*` | Scales every target can share                                                                                                                                                                                                                                                                                                                                                           | catalog-default constants unless you author them                                                                                     |

Anything else you define under `semantic.*` is a **custom semantic token** — legal, carried, mode-aware, and the recommended home for your own vocabulary ([adoption guide](/docs/adopt-existing/), step 2). A custom role can also declare an _archetype_ (`brand`/`status`/`neutral`) via `$extensions.transtyle.role` to get the full grid derived like a built-in — <span class="badge live">compiled</span>. Roles with an open set (daisyUI, css-variables) emit it; closed-set targets (Bootstrap, shadcn, ECharts, Storybook, Radix) don't have a slot for it and skip it. [Cathode's `crt-amber`](/docs/examples/#cathode--the-hostile-example) demonstrates it end to end.

## The component tier

Everything above is the **semantic** tier — meanings that hold regardless of what you build with them. The `component.*` tier is the third and last tier: decisions that are about a specific kind of UI element and cannot be stated any other way.

It is deliberately tiny, and stays tiny by rule (below):

| Slot                                 | Meaning                       | Defaults from                  |
| ------------------------------------ | ----------------------------- | ------------------------------ |
| `component.control.radius`           | shared shape of form controls | `semantic.radius.control`      |
| `component.control.padding-x` / `-y` | padding shared by controls    | `semantic.space.4` / `space.2` |
| `component.button.radius`            | button shape                  | `component:control.radius`     |
| `component.button.padding-x` / `-y`  | button padding                | `component:control.padding-*`  |

The `component:` prefix makes the tier **layered**, and that layering carries an authoring intent no flat vocabulary can express:

```
author component.control.radius  →  buttons AND inputs move   ("controls are rounder")
author component.button.radius   →  only buttons move          ("buttons are pills")
```

One authored line, and the exporters reproduce the distinction on targets that model it in incompatible ways: Bootstrap chains buttons and inputs through a shared `$input-btn-*` root, PrimeNG keeps `button.*` and `formField.*` entirely separate. Authoring `component.button.radius: "{semantic.radius.full}"` produces a 9999px pill in **both**, without moving inputs in either.

### Why it isn't bigger

Both reference targets expose enormous component surfaces — 657 themable Bootstrap variables, 2759 PrimeNG slots — and it would be easy to mint a catalog slot for each. That would produce a vocabulary shaped like whichever target was read last, which is the failure mode this whole design exists to avoid.

So nothing enters the component tier without **two independent exporters needing the identical thing, for architectural rather than nominal reasons**. Two examples of the rule doing work, both recorded in `docs/proposals/0003-component-catalog-generalization.md`:

- **Accepted:** control padding/radius. Bootstrap and PrimeNG both treat "a control's box" as one shared decision, arrived at independently. That's architectural correspondence.
- **Rejected:** the `sm`/`lg` size ladder. Both targets have one — and they disagree about which rungs it has. The disagreement _is_ the finding: a shared slot would have to pick a winner, so exporters keep deriving their own.

Everything a target needs beyond the catalog stays inside that exporter, where it belongs. The measured result is that Bootstrap variables not bound to a catalog slot are overwhelmingly reached anyway — through the target's own `!default` chains and CSS custom properties — rather than left untouched.

## False friends

The reason a pivot language must exist: the same word means different things across ecosystems, and Transtyle's job is to translate _meanings_, never names.

| Word          | In the catalog                                                                   | In shadcn                                                       | In Bootstrap                                                  | In Radix                                                  |
| ------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| **secondary** | second _brand_ color                                                             | subtle gray button surface (`--secondary` ← our `neutral.tint`) | a theme color (≈ ours)                                        | —                                                         |
| **accent**    | brand emphasis color                                                             | hover-highlight tint (`--accent` ← our `accent.tint`)           | not a concept                                                 | the _only_ brand color (their one accent ≈ our `primary`) |
| **muted**     | not a slot (see `text.muted`, `neutral.tint`)                                    | a surface _and_ a foreground pair                               | text utility                                                  | —                                                         |
| **outline**   | `<role>.outline` — a border-only wash, one prominence step below `solid`         | not a slot (Tailwind `border` utility on `--border`)            | —                                                             | steps 7/8                                                 |
| **subtle**    | `<role>.tint` (one wash, all states)                                             | `muted` = a surface+foreground pair                             | `-bg-subtle`/`-border-subtle` (now bound to `tint`/`outline`) | steps 3–5 (a _range_, not one value)                      |
| **selected**  | `<role>.solid-selected` / `tint-selected` (aliases of `-active` unless authored) | not a concept                                                   | not a concept                                                 | not a concept                                             |

Exporter mapping tables encode these translations once, reviewed by people who know both languages — that's why exporters bind to the catalog and never to your names, and why you should bind your names by meaning, not spelling. The comparative study behind the grid — 14 ecosystems, their tier architectures, and per-ecosystem conversion tables — lives in `docs/proposals/0001-universal-token-ir.md`.

The table above already shows this isn't just "different word, same slot": `<role>.outline` alone shows up as a Tailwind border utility in shadcn, nothing in Bootstrap, and a numbered step range in Radix — one catalog concept, three unrelated target shapes. The same holds in the other direction: nothing stops one catalog token from feeding several differently-named places inside a _single_ target's own structure, when that target's internal organization (a shared token group, a flat per-context naming scheme, whatever it is) simply isn't shaped like the catalog. Translating by meaning means the mapping is exporter-owned and can be as many-to-many as the target actually needs — it never obligates the catalog to grow a matching concept for every target's internal grouping.

## How the language grows

The catalog is deliberately fixed per version — it's the compiler's instruction set. Growth is evidence-driven, and the evidence has a specific shape: **two independent exporters must need the identical thing for architectural, not nominal, reasons.** One target wanting something is a feature request for that exporter; two targets arriving at the same structure independently is a fact about design systems, which is the only kind of fact this vocabulary should encode.

That is why the reports matter. Every exporter classifies every slot of its target's documented surface, and an `unsupported` row is a claim on the record that the IR can't express something — the raw material for the next catalog decision. The current named growth signals, all from measured coverage rather than intuition: component icon/asset slots (Bootstrap embeds 16 SVG data-URIs the IR has no vocabulary for), component geometry and sizing (25 more), breakpoints, and compositional opacity (a catalog factor applied to a target's own resting value). Each is waiting on a second target needing the same thing. Pre-release, the catalog can still change in place — the role grid above landed exactly that way (a breaking revision, not a version bump: Transtyle is unreleased, so there was no compatibility to preserve, see `docs/adr/0010-pre-release-breaking-changes.md`). Once Transtyle publishes, growth becomes additive-only — nothing removed or re-typed within a major. Your token files outlive our versions.
