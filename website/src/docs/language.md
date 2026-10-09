---
title: 'The Transtyle language'
description: 'The semantic catalog as an interlingua: every slot, how values enter it (aliases or derivation), and how they exit to each target.'
order: 4
---

# The Transtyle language

Machine translation between many languages doesn't build a translator per pair — it translates through a pivot language, an _interlingua_. Transtyle's semantic catalog is exactly that. Your design system's semantics map **into** the catalog (manually via aliases, or automatically via derivation); each target library's semantics map **out of** it (via each exporter's mapping table). N design systems × M libraries, through one vocabulary.

<figure class="dg" id="dg-pivot">
  <div class="dg__scroll">
    <svg viewBox="0 0 720 248" role="img" aria-labelledby="dg-pivot-t dg-pivot-d">
      <title id="dg-pivot-t">The pivot vocabulary: your semantics, the catalog, each library's semantics</title>
      <desc id="dg-pivot-d">Three columns. In your semantics, "brand-action" aliases the catalog slot primary.solid and "flame-soft" aliases primary.tint; nothing is authored for primary.on-solid, so a rule fills it. In the catalog, primary.solid maps by table to --primary (shadcn), primary.tint maps by table to color[0] (ECharts), and primary.on-solid maps by table to --primary-foreground.</desc>
      <defs>
        <marker id="dg-pivot-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 Z" class="dg-head" />
        </marker>
      </defs>
      <text class="dg-title" x="16" y="28"><tspan class="dg-num">01</tspan> Your semantics</text>
      <text class="dg-title" x="258" y="28"><tspan class="dg-num">02</tspan> The catalog (pivot)</text>
      <text class="dg-title" x="516" y="28"><tspan class="dg-num">03</tspan> Library semantics</text>
      <g class="dg-node"><rect x="16" y="56" width="152" height="48" /><text class="dg-code" x="92" y="80">"brand-action"</text></g>
      <g class="dg-node"><rect x="16" y="120" width="152" height="48" /><text class="dg-code" x="92" y="144">"flame-soft"</text></g>
      <g class="dg-node is-empty"><rect x="16" y="184" width="152" height="48" /><text class="dg-code" x="92" y="208">(nothing)</text></g>
      <g class="dg-node"><rect x="258" y="56" width="168" height="48" /><text class="dg-code" x="342" y="80">primary.solid</text></g>
      <g class="dg-node"><rect x="258" y="120" width="168" height="48" /><text class="dg-code" x="342" y="144">primary.tint</text></g>
      <g class="dg-node"><rect x="258" y="184" width="168" height="48" /><text class="dg-code" x="342" y="208">primary.on-solid</text></g>
      <g class="dg-node"><rect x="516" y="56" width="188" height="48" /><text class="dg-code" x="610" y="80">--primary <tspan class="dg-aside">(shadcn)</tspan></text></g>
      <g class="dg-node"><rect x="516" y="120" width="188" height="48" /><text class="dg-code" x="610" y="144">color[0] <tspan class="dg-aside">(ECharts)</tspan></text></g>
      <g class="dg-node"><rect x="516" y="184" width="188" height="48" /><text class="dg-code" x="610" y="208">--primary-foreground</text></g>
      <path class="dg-edge" d="M168,80 H256" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <path class="dg-edge" d="M168,144 H256" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <path class="dg-edge" d="M168,208 H256" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <path class="dg-edge" d="M426,80 H514" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <path class="dg-edge" d="M426,144 H514" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <path class="dg-edge" d="M426,208 H514" pathLength="1" marker-end="url(#dg-pivot-arrow)" />
      <text class="dg-label" x="213" y="72">alias</text>
      <text class="dg-label" x="213" y="136">alias</text>
      <text class="dg-label" x="213" y="200">rule</text>
      <text class="dg-label" x="470" y="72">table</text>
      <text class="dg-label" x="470" y="136">table</text>
      <text class="dg-label" x="470" y="200">table</text>
    </svg>
  </div>
  <figcaption>Figure 1 · the pivot vocabulary: your names alias catalog slots, or a rule fills a slot nobody wrote; each slot then maps by table to one variable per library.</figcaption>
</figure>
<style>
  #dg-pivot { margin: var(--space-6) 0; border: var(--stroke-hairline) solid var(--color-line); background: var(--color-bg); }
  #dg-pivot .dg__scroll { overflow-x: auto; }
  #dg-pivot svg { display: block; width: 100%; height: auto; min-width: 655px; }
  #dg-pivot figcaption { padding: var(--space-2) var(--space-3); border-top: var(--stroke-hairline) solid var(--color-line);
    font: var(--font-size-xs) / var(--font-line-height-body) var(--font-family-mono); color: var(--color-muted); }
  #dg-pivot .dg-node rect { fill: var(--color-panel); stroke: var(--color-line); stroke-width: 1; }
  #dg-pivot .dg-node.is-empty rect { fill: none; stroke: var(--color-muted); stroke-dasharray: 4 3; }
  #dg-pivot .dg-node.is-empty text { fill: var(--color-muted); }
  #dg-pivot .dg-code { fill: var(--color-fg); text-anchor: middle; dominant-baseline: middle; font: var(--font-weight-regular) 13px var(--font-family-mono); }
  #dg-pivot .dg-aside { fill: var(--color-muted); }
  #dg-pivot .dg-title { font: var(--font-weight-semibold) 11px var(--font-family-display); letter-spacing: var(--font-letter-spacing-eyebrow);
    text-transform: uppercase; fill: var(--color-muted); }
  #dg-pivot .dg-num { font-family: var(--font-family-mono); fill: var(--color-primary); }
  #dg-pivot .dg-label { font: 11px var(--font-family-mono); fill: var(--color-muted); text-anchor: middle; }
  #dg-pivot .dg-edge { fill: none; stroke: var(--color-primary); stroke-width: 1.5; }
  #dg-pivot .dg-head { fill: var(--color-primary); }
</style>

This page is the full pivot vocabulary as implemented today — <span class="badge live">compiled</span> unless marked <span class="badge spec">specced</span> (exists in the [IR specification](/docs/internals/), not yet compiled). Swatches show real derived values from the [Acme example](/docs/examples/)'s single blue brand color.

The same vocabulary as data — every slot with its type, the rule that fills it when you don't, that rule's inputs, and the anchor it needs — is one command away: `transtyle catalog`, or `transtyle catalog --json` for tools ([CLI reference](/docs/cli/#transtyle-catalog---json)). The tables below are checked against it on every build, so a slot can't be added to the engine without a row here.

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

Which targets read each cell of the grid, role by role: [slot matrix](/docs/slot-matrix/#color-primary).

## Elevation, content, and the rest

Surfaces are an **elevation ladder**, not four separate named slots — each level projects a surface color, and levels 1–4 pair with a shadow:

| Slot                                                                                                                                                     | Meaning                                                                                                                                                                                                                                                                                                                                                                                 | Derivation                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `elevation.0.surface`                                                                                                                                    | The page                                                                                                                                                                                                                                                                                                                                                                                | author it                                                                                                                            |
| `elevation.1.surface`                                                                                                                                    | Cards, panels                                                                                                                                                                                                                                                                                                                                                                           | author it (falls back to level 0)                                                                                                    |
| `elevation.2.surface`                                                                                                                                    | Raised layer                                                                                                                                                                                                                                                                                                                                                                            | raise(level 1)                                                                                                                       |
| `elevation.3.surface`                                                                                                                                    | Floating layers: popover, menu, dialog                                                                                                                                                                                                                                                                                                                                                  | raise(level 2) — deliberately one step further than a merely-raised card                                                             |
| `elevation.4.surface` / `elevation.5.surface`                                                                                                            | Deeper stacking contexts                                                                                                                                                                                                                                                                                                                                                                | raise(previous level)                                                                                                                |
| `elevation.1..4.shadow`                                                                                                                                  | Paired shadow per level                                                                                                                                                                                                                                                                                                                                                                 | composed from `scrim` at fixed alpha ramps                                                                                           |
| `scrim`                                                                                                                                                  | Dimming veil behind modals                                                                                                                                                                                                                                                                                                                                                              | near-black at fixed alpha — a veil, not an elevation level                                                                           |
| `text.base` / `text.muted` / `text.subtle` / `text.disabled` / `text.strong` / `text.inverse`                                                            | Content hierarchy                                                                                                                                                                                                                                                                                                                                                                       | author `text.base`; the rest derive from it (`.strong` aliases `neutral.text-strong`; `.inverse` reads the other mode's `text.base`) |
| `link.base` / `.hover` / `.visited`                                                                                                                      | Link colors                                                                                                                                                                                                                                                                                                                                                                             | alias of `primary.text` and its states, hue-shifted for visited                                                                      |
| `border` / `ring`                                                                                                                                        | Lines and focus                                                                                                                                                                                                                                                                                                                                                                         | author `border`; `ring` ← primary, lightened in dark                                                                                 |
| `palette.categorical.1–8`                                                                                                                                | Data-viz series colors <span class="sw" style="--c:#026fd7"></span><span class="sw" style="--c:#d15c56"></span><span class="sw" style="--c:#319751"></span><span class="sw" style="--c:#d4a73e"></span><span class="sw" style="--c:#975ac0"></span><span class="sw" style="--c:#00a6ae"></span><span class="sw" style="--c:#d779ba"></span><span class="sw" style="--c:#7e8814"></span> | hue rotation from primary, distinguishability-banded; entries 1–5 frozen (cross-target contract)                                     |
| `radius.md`, `font.sans`, `font.mono`                                                                                                                    | Shape and type                                                                                                                                                                                                                                                                                                                                                                          | author them                                                                                                                          |
| `radius.none` / `.sm` / `.lg` / `.xl` / `.full`                                                                                                          | The radius scale                                                                                                                                                                                                                                                                                                                                                                        | `radius.md` × 0 / × 0.5 / × 1.5 / × 2; `full` is 9999px                                                                              |
| `radius.control` / `.field` / `.container`                                                                                                               | Radius per family of element                                                                                                                                                                                                                                                                                                                                                            | alias of `radius.md` unless you author them                                                                                          |
| `font.display`                                                                                                                                           | Display face                                                                                                                                                                                                                                                                                                                                                                            | optional: when authored, `type.role.display.*` use it instead of `font.sans`                                                         |
| `space.*`, `size.control.*`, `border-width.*`, `opacity.disabled`, `breakpoint.*`, `z.*`, `type.*` (+ composite `type.role.*`), `duration.*`, `easing.*` | Scales every target can share                                                                                                                                                                                                                                                                                                                                                           | catalog-default constants unless you author them                                                                                     |

Which targets read each of these slots: [slot matrix](/docs/slot-matrix/#color-elevation).

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
| `component.tooltip.max-width`        | how wide a tooltip may grow   | _nothing — authored only_      |

Which targets read each component slot: [slot matrix](/docs/slot-matrix/#component-button).

The `component:` prefix makes the tier **layered**, and that layering carries an authoring intent no flat vocabulary can express:

```
author component.control.radius  →  buttons AND inputs move   ("controls are rounder")
author component.button.radius   →  only buttons move          ("buttons are pills")
```

One authored line, and the exporters reproduce the distinction on targets that model it in incompatible ways: Bootstrap chains buttons and inputs through a shared `$input-btn-*` root, PrimeNG keeps `button.*` and `formField.*` entirely separate. Authoring `component.button.radius: "{semantic.radius.full}"` produces a 9999px pill in **both**, without moving inputs in either.

### Why it isn't bigger

<!-- measured: bootstrap.surface.component = 657 -->
<!-- measured: primeng.surface.total = 2759 -->

Both reference targets expose enormous component surfaces — 657 themable Bootstrap variables, 2759 PrimeNG slots — and it would be easy to mint a catalog slot for each. That would produce a vocabulary shaped like whichever target was read last, which is the failure mode this whole design exists to avoid.

So nothing enters the component tier without **two independent exporters needing the identical thing, for architectural rather than nominal reasons**. Two examples of the rule doing work, both recorded in `docs/proposals/0003-component-catalog-generalization.md`:

- **Accepted:** control padding/radius. Bootstrap and PrimeNG both treat "a control's box" as one shared decision, arrived at independently. That's architectural correspondence.
- **Rejected:** the `sm`/`lg` size ladder. Both targets have one — and they disagree about which rungs it has. The disagreement _is_ the finding: a shared slot would have to pick a winner, so exporters keep deriving their own.

The rule has since been run once more, over the whole of component **geometry** — 25 Bootstrap sizing variables against PrimeNG's 243 width/height/size slots. It rejected nine of the ten concepts and accepted one:

- **Accepted:** `tooltip.max-width`. Both libraries constrain how wide a tooltip may grow, both with a `max-width` on the tooltip root, both at the same measure — Bootstrap `200px`, PrimeNG `12.5rem`, which is 200px. And both are selective about it: PrimeNG has exactly two `maxWidth` slots in 2759. Two libraries agreeing that _this specific element_ is the one needing a width ceiling.
- **Rejected — false friend:** `$toast-max-width: 350px` against PrimeNG's `toast.root.width: 22rem` (352px). Nearly the same number, opposite box semantics: one grows to its content up to a ceiling, the other is fixed. The near-coincidence is exactly what a name-and-number comparison would have promoted.
- **Rejected — one-sided:** spinner size, popover width, the modal size ladder, offcanvas dimensions. PrimeNG hard-codes every one of them; there is nothing to correspond with.

The full ledger is in `docs/proposals/0004-component-geometry.md`. The point of writing down the rejections is that the next probe doesn't re-litigate them.

Everything a target needs beyond the catalog stays inside that exporter, where it belongs. The measured result is that Bootstrap variables not bound to a catalog slot are overwhelmingly reached anyway — through the target's own `!default` chains and CSS custom properties — rather than left untouched.

## False friends

The reason a pivot language must exist: the same word means different things across ecosystems, and Transtyle's job is to translate _meanings_, never names.

| Word                 | In the catalog                                                                   | In shadcn                                                       | In Bootstrap                                                         | In Radix                                                  | In Chakra UI                                                                        | In Material UI                                                                                    |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **secondary**        | second _brand_ color                                                             | subtle gray button surface (`--secondary` ← our `neutral.tint`) | a theme color (≈ ours)                                               | —                                                         | — (no secondary palette)                                                            | a palette colour (≈ ours, same name)                                                              |
| **accent**           | brand emphasis color                                                             | hover-highlight tint (`--accent` ← our `accent.tint`)           | not a concept                                                        | the _only_ brand color (their one accent ≈ our `primary`) | —                                                                                   | not a palette colour (an extra key)                                                               |
| **muted**            | not a slot (see `text.muted`, `neutral.tint`)                                    | a surface _and_ a foreground pair                               | text utility                                                         | —                                                         | `colorPalette.muted`: a tint depth, the hover of `subtle` (our `<role>.tint-hover`) | —                                                                                                 |
| **outline**          | `<role>.outline` — a border-only wash, one prominence step below `solid`         | not a slot (Tailwind `border` utility on `--border`)            | —                                                                    | steps 7/8                                                 | a button variant whose border is `colorPalette.border` (our `<role>.outline`)       | `variant="outlined"`, bordered by `alpha(main, 0.5)` (here our `<role>.outline`)                  |
| **subtle**           | `<role>.tint` (one wash, all states)                                             | `muted` = a surface+foreground pair                             | `-bg-subtle`/`-border-subtle` (now bound to `tint`/`outline`)        | steps 3–5 (a _range_, not one value)                      | `colorPalette.subtle`: the lightest tint (our `<role>.tint`)                        | —                                                                                                 |
| **selected**         | `<role>.solid-selected` / `tint-selected` (aliases of `-active` unless authored) | not a concept                                                   | not a concept                                                        | not a concept                                             | not a concept                                                                       | `action.selected`: one translucent veil for every list                                            |
| **emphasized**       | not a slot (the deepest tint is `<role>.tint-active`)                            | —                                                               | `-text-emphasis`: text on a subtle background (our `<role>.on-tint`) | —                                                         | `colorPalette.emphasized`: the deepest tint (our `<role>.tint-active`)              | —                                                                                                 |
| **dark** / **light** | the two values of the `color-scheme` mode                                        | —                                                               | —                                                                    | —                                                         | —                                                                                   | `palette.<color>.dark` / `.light`: shades of `main`, not schemes (here `solid-hover` / `outline`) |

Exporter mapping tables encode these translations once, reviewed by people who know both languages — that's why exporters bind to the catalog and never to your names, and why you should bind your names by meaning, not spelling. The comparative study behind the grid — 14 ecosystems, their tier architectures, and per-ecosystem conversion tables — lives in `docs/proposals/0001-universal-token-ir.md`.

The table above already shows this isn't just "different word, same slot": `<role>.outline` alone shows up as a Tailwind border utility in shadcn, nothing in Bootstrap, and a numbered step range in Radix — one catalog concept, three unrelated target shapes. The same holds in the other direction: nothing stops one catalog token from feeding several differently-named places inside a _single_ target's own structure, when that target's internal organization (a shared token group, a flat per-context naming scheme, whatever it is) simply isn't shaped like the catalog. Translating by meaning means the mapping is exporter-owned and can be as many-to-many as the target actually needs — it never obligates the catalog to grow a matching concept for every target's internal grouping.

## How the language grows

The catalog is deliberately fixed per version — it's the compiler's instruction set. Growth is evidence-driven, and the evidence has a specific shape: **two independent exporters must need the identical thing for architectural, not nominal, reasons.** One target wanting something is a feature request for that exporter; two targets arriving at the same structure independently is a fact about design systems, which is the only kind of fact this vocabulary should encode.

That is why the reports matter. An `unsupported` row is a claim on the record that a target themes something the IR can't express — the raw material for the next catalog decision. Only an exporter that inventories its target's whole surface can make that claim exhaustively (Bootstrap, PrimeNG and Mantine do; ECharts names its one known gap). Each row can say what it is missing as a `meaning` key, and the [catalog-signals report](https://github.com/transtyle/transtyle/blob/main/docs/findings/catalog-signals.md) groups those keys across every exporter and example, compiled rather than collected by hand and kept current by `check:catalog-signals`. What it shows today, all measured rather than intuited: icon size is the one concept two exporters report — PrimeNG systematically, Bootstrap ad hoc — and stays on watch until a third target brings a systematic model; per-component opacity, compositional opacity (a catalog factor applied to a target's own resting value), an inset shadow, a default gradient and heading text-wrap are open, each waiting on a second target; icon assets are watched too, with one source so far; component geometry, breakpoints and the display ladder are settled, each with the proposal or worklog that settled it. Through the alpha, the catalog can still change in place — the role grid above landed exactly that way, as a breaking revision rather than a version bump (see `docs/adr/0010-pre-release-breaking-changes.md`; publishing the alpha deliberately did not end that, because a prerelease identifier is not a stability promise). At the first release without one, growth becomes additive-only — nothing removed or re-typed within a major. Your token files outlive our versions.
