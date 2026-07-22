# Proposal 0001 — The universal token IR (the role grid)

**Status: ACCEPTED 2026-07-20, as amended by [ADR-0010](../adr/0010-pre-release-breaking-changes.md).** The amendment supersedes this document's compatibility posture and its version framing: Transtyle is unreleased, so the revised catalog lands as a **clean break, not a version bump** — old names are removed, not aliased; there is no "v1", the spec stays `v0` throughout (§7's "v1"/`standard@2` language below is superseded — the rule pack keeps its id `standard@1` and is redefined in place); §3.1's alias table is reinterpreted as the _migration rename table_; cell naming is flattened (`solid`, `solid-hover`, `on-solid` — rest is the bare prominence name). Implementation is sequenced and fully specified in [docs/plan/catalog-revision.md](../plan/catalog-revision.md) (tasks T1…T11); the freeze policy re-arms at first npm publication.
**Original posture (historical):** written to land as additive minors within v0's stability policy, with every v0 name preserved as a permanent alias.
**Provenance of the study:** ecosystem facts below are from direct knowledge of these systems' public token sets (state of early 2026). Exact pixel/step _values_ in vendor tables are illustrative and may drift with vendor releases; the proposal depends only on their _shapes_, which are stable across years of releases. Verify values against upstream before implementing any single mapping table.

---

## 1. Objective and method

Make Transtyle's semantic catalog the **minimal universal interlingua** for design-system theming: any design system in, any component library out, with measured — not silent — information loss.

Method: for each token category, lay the major ecosystems side by side; extract (a) the shared abstraction, (b) same-meaning/different-name pairs (false friends registry), (c) genuinely unique concepts; then derive the smallest concept set that spans all of them; then check the current v0 catalog against that set and propose the delta.

Ecosystems studied: **Material 3** (ref/sys/comp), **Ant Design v5** (seed→map→alias→component), **Fluent 2** (global/alias), **Carbon v11** (core/theme/layer), **Spectrum** (global/alias/component + platform scale), **Radix Themes + Radix Colors** (12-step scales), **Chakra v3 / Panda CSS** (tokens/semanticTokens/recipes), **Mantine** (10-step scales + variants), **shadcn/ui** (flat semantic pairs), **Tailwind CSS** (option scales only), **daisyUI** (role + content pairs), **Bootstrap 5.3** (Sass + subtle triads), **Open Props** (option scales only), **Base UI** (unstyled; state attribute conventions), plus the **DTCG** format itself.

---

## 2. Comparative study

### 2.1 Tier architecture

| Ecosystem                    | Tiers (their names)                            | Notes                                                                                                   |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Material 3                   | `ref` → `sys` → `comp`                         | the canonical three-tier                                                                                |
| Ant Design v5                | seed → map → alias → component                 | _four_ tiers: "map" is a generated per-role ramp between seed and alias — i.e. **derivation is a tier** |
| Fluent 2                     | global → alias (→ per-control)                 |                                                                                                         |
| Carbon v11                   | core (white/g10/g90/g100 themes) → component   | themes are _value sets_, structure is two-tier                                                          |
| Spectrum                     | global → alias → component                     | heaviest component tier in the industry                                                                 |
| Chakra v3 / Panda            | `tokens` → `semanticTokens` → recipes          | recipes ≈ component tier as functions                                                                   |
| Tailwind / Open Props        | option only                                    | semantics live in usage, not tokens                                                                     |
| shadcn / daisyUI / Bootstrap | semantic only (options implicit)               | consume-side systems                                                                                    |
| **Transtyle v0**             | `option` → `semantic` → `component` (reserved) | ✅ aligned                                                                                              |

**Finding T1.** Three tiers with the middle one as the stable binding surface is the industry-convergent architecture; Ant's insight — that a _generated ramp_ sits between authored seeds and consumed aliases — is exactly Transtyle's DERIVE stage. **Keep the v0 tier model unchanged.** The component tier stays reserved (ADR-0003), but §5.7 defines its inheritance semantics now so v2 doesn't improvise them.

### 2.2 Color: per-role structure — the central finding

How each system structures "a color role" (using their brand/primary as the specimen):

| System                         | Per-role slots (shape)                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Radix Colors**               | 12 steps with _fixed meanings_: 1 app bg · 2 subtle bg · 3 UI bg · 4 UI bg hover · 5 UI bg active · 6 subtle border · 7 border · 8 border hover · 9 solid · 10 solid hover · 11 low-contrast text · 12 high-contrast text |
| **Ant Design v5** (map tokens) | `Bg`, `BgHover`, `Border`, `BorderHover`, `Hover`, _(base)_, `Active`, `TextHover`, `Text`, `TextActive` — 10 slots                                                                                                       |
| **Material 3**                 | `primary`, `on-primary`, `primary-container`, `on-primary-container` (+ `inverse-primary`); states are _state layers_ (opacity overlays), not slots                                                                       |
| **Fluent 2**                   | `BrandBackground{,Hover,Pressed,Selected}`, `BrandForeground1/2`, `BrandStroke1/2`; neutrals: `Background1..6 × {Rest,Hover,Pressed,Selected}`, `Foreground1..4`                                                          |
| **Chakra v3** (`colorPalette`) | `solid`, `contrast` (on-solid), `fg` (role as text), `subtle`, `muted`, `emphasized` (three tint depths), `focusRing`                                                                                                     |
| **Bootstrap 5.3**              | `$primary` + `-bg-subtle` + `-border-subtle` + `-text-emphasis` (+ Sass-baked hover/active)                                                                                                                               |
| **Mantine** (via variants)     | `filled`, `light`, `outline`, `subtle`, `transparent` — variant _names_, resolved against the 10-step scale                                                                                                               |
| **shadcn**                     | `--primary` + `--primary-foreground`; tints appropriated from other slots (`secondary`, `accent`, `muted`)                                                                                                                |
| **daisyUI**                    | `--color-primary` + `--color-primary-content`                                                                                                                                                                             |
| **Carbon**                     | role split across purpose tokens (`interactive`, `link-primary`, `support-error`…) with `-hover`/`-active` suffixes                                                                                                       |
| **Spectrum**                   | `accent-background-color-{default,hover,down,key-focus}`, `accent-content-color-*`, `accent-visual-color`                                                                                                                 |
| **Transtyle v0**               | `base`, `hover`, `active`, `subtle`, `contrast` + `text-on-<role>.{base,subtle}`                                                                                                                                          |

**Finding C1 (the load-bearing one).** Every mature system is sampling the _same underlying two-axis grid_, and each names its own sparse sample of it:

- **Axis 1 — prominence** (how much visual weight the role carries): _tinted background_ → _tinted border_ → _solid fill_ → _role-as-foreground-text_. Radix quantizes this axis as step groups (2–5 / 6–8 / 9–10 / 11–12); Ant as `Bg/Border/(base)/Text`; Bootstrap as its subtle triad; Chakra as `subtle/muted/emphasized–solid–fg`; Mantine/shadcn button _variants_ (`filled/light/outline/subtle`) are prominence levels **worn by a component** — which means variant translation between component libraries is prominence-axis arithmetic, not per-pair guesswork.
- **Axis 2 — interaction state**: rest → hover → active(pressed/down) → selected → disabled, orthogonal to prominence. Radix 3/4/5 is `tint × {rest,hover,active}`; Ant `BgHover`, `BorderHover`, `TextHover/Active`; Fluent's `{Rest,Hover,Pressed,Selected}` suffixes; Spectrum's `{default,hover,down}`.
- **Plus on-colors**: any prominence level that acts as a _surface_ needs a paired readable foreground (M3 `on-*`, shadcn `-foreground`, daisyUI `-content`, Spectrum `content-color`). Only `solid` and `tint` host content; `outline` and `text` sit _on_ the ambient surface.

Transtyle v0's five-position scale is itself a sparse sample: `base/hover/active` = solid × three states; `subtle` = tint × rest; `contrast` ≈ text × strong. It cannot express Radix 4 (tint hover), Ant `Border` (the Bootstrap exporter had to invent `mix(role, surface, 0.70)` as a private convention — finding F10), Ant `Text` (Bootstrap's `-text-emphasis` was bound to `text-on-<role>.subtle`, which _coincides_ numerically but is semantically "content on tint", not "role as text"), or Fluent's `Selected` anywhere. Every one of those gaps is currently an exporter convention — i.e., unshared, unexplainable, un-overridable vocabulary. That is the exact failure mode the catalog exists to prevent.

**Finding C2 (role sets).** Role _names_ converge on three archetypes:

| Archetype   | Members across ecosystems                                                                                  | Notes                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **brand**   | primary; secondary (Transtyle/Bootstrap/M3); tertiary (M3); accent (Radix/Chakra/Spectrum); brand (Fluent) | count varies 1–3; "accent" sometimes = primary (Radix has _one_ accent), sometimes an extra |
| **status**  | success/positive · warning/notice · danger/error/negative/destructive · info/informative                   | four everywhere; only the spelling differs                                                  |
| **neutral** | neutral/gray/grey/base (daisyUI `base-*`)/neutralVariant (M3)                                              | 1–2 families (M3 splits neutral/neutral-variant)                                            |

False friends confirmed beyond v0's registry: **secondary** (brand №2 vs shadcn's gray surface vs M3's tonal role), **accent** (brand emphasis vs shadcn hover-tint vs Radix's _only_ brand color), **muted** (Chakra tint depth vs shadcn surface+fg pair vs "text-muted"), **subtle** (Radix step 2 app-level vs Bootstrap per-role tint vs Fluent transparent backgrounds), **base** (Transtyle "rest value" vs daisyUI "app surface ladder" vs Ant seed).

### 2.3 Surfaces and elevation

| System           | Model                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Material 3       | numbered **elevation levels 0–5**; each level = shadow + surface tint; surface roles `surface-container-{lowest,low,·,high,highest}` + `surface-{dim,bright}`      |
| Carbon v11       | **layer model**: `background` → `layer-01` → `layer-02` → `layer-03` (+ `field-01/02`, `border-subtle-00..03` _per layer_); dark themes make higher layers lighter |
| Fluent 2         | `NeutralBackground1..6` (ambient ladder) + shadow ramp `shadow2..64`                                                                                               |
| Chakra v3        | `bg`, `bg.subtle`, `bg.muted`, `bg.panel`, `bg.emphasized`, `bg.inverted`                                                                                          |
| Radix            | steps 1–2 of the gray scale (app bg, subtle bg) + panel translucency                                                                                               |
| Bootstrap        | `body-bg`, `body-secondary-bg`, `body-tertiary-bg`                                                                                                                 |
| **Transtyle v0** | `background`, `surface`, `surface-raised`, `overlay`, `scrim`                                                                                                      |

**Finding E1.** Two philosophies — _elevation-as-shadow_ (M3, Fluent) and _elevation-as-layer-color_ (Carbon, and every dark theme ever) — are the same concept rendered through different properties. The universal abstraction is an **elevation ladder** whose levels each project onto: a surface color, a shadow, a z-band, and (optionally) a tint overlay. v0 already stated "shadows and z-index are one concept"; it just didn't give the ladder levels first-class names, so `surface-raised` is the whole ladder collapsed to one step and Carbon's `layer-03` or M3's `surface-container-highest` have nowhere to land.

### 2.4 Content (text) hierarchy

Carbon: `text-primary/secondary/helper/placeholder/disabled/on-color/inverse` · Fluent: `Foreground1..4` + disabled · M3: `on-surface`, `on-surface-variant` · Chakra: `fg`, `fg.muted`, `fg.subtle`, `fg.inverted`. **Finding X1:** the universal ladder has _four_ rungs plus two specials: strong(≈heading) / default / muted / subtle(placeholder-helper) + disabled + inverse. v0 has two (`text`, `text-muted`) — and the Storybook exporter already needed `inverse` (cross-mode read, F15) without a slot for it.

### 2.5 Spacing, sizing, radius, borders

| Category       | Convergent shape                               | Divergent encodings                                                                                                                                                             |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing        | one ordinal ramp, roughly geometric at the top | numeric ×0.25rem (Tailwind/Chakra/Panda: `4` = 1rem) · ordinal names (Carbon `spacing-01..13`) · t-shirt (Fluent/Mantine/Spectrum `xs..xxxl`) · factor (Radix `1..9` × scaling) |
| Component size | control heights + paddings per t-shirt size    | Ant `controlHeight{SM,,LG}` · Mantine/Chakra `size=xs..xl` · Spectrum S/M/L/XL · M3/Spectrum **density/platform scale as a multiplier**                                         |
| Radius         | ordinal none→full                              | M3 shape scale (0/4/8/12/16/28/full) · Fluent (0/2/4/6/8/circular) · Radix radius _factor_ (multiplies all) · daisyUI **radius by component family** (`selector/field/box`)     |
| Border width   | 1–3 steps                                      | Tailwind 0/2/4/8; most systems just "1px + focus width"                                                                                                                         |

**Finding S1.** Scales are the easy universal: an **ordinal key list + a declared progression** (base × ratio, or explicit) covers every encoding; exporters map by key or re-quantize by value (flagged `approximated`). daisyUI's per-family radius (`control` vs `field` vs `container`) is the one _semantic_ radius idea worth adopting as aliases over the scale. Spectrum's platform scale and M3 density are **mode dimensions**, already representable in v0's mode system — they need only reserved dimension names.

### 2.6 Typography

M3 typescale (`display/headline/title/body/label × large/medium/small`) · Fluent styles (`caption/body/subtitle/title/largeTitle/display`) · Carbon sets (`body-01`, `heading-01..07`, productive vs expressive) · Ant (`fontSize`, `fontSizeHeading1..5`) · Tailwind (primitives only). **Finding TY1:** two layers, both needed: **primitive scales** (family/size/weight/leading/tracking — v0 has these specced) and **composite type roles** (DTCG `typography` type) with the M3-shaped matrix as the canonical key set — it's the only one fine-grained enough to project onto all others (`display/heading/title/body/label/code × sm/md/lg`).

### 2.7 Motion

M3: duration ramps `short1..extra-long4` + easing `standard/emphasized(±accelerate/decelerate)` (+ springs in Expressive) · Fluent: `durationUltraFast..Slower` + curve set · Open Props: springs/elastic as first-class · Carbon: productive/expressive pairs. **Finding M1:** universal = duration ordinal (instant/fast/normal/slow/slower) × easing set (standard, emphasized, enter/decelerate, exit/accelerate, spring). v0 has this minus `spring` and minus an `enter/exit` naming note. Reduced motion = a mode dimension, not tokens.

### 2.8 Z-index, breakpoints, states

- **Z:** Bootstrap (1000..1090 ladder) and Chakra (`hide..tooltip`) agree on the _ladder members_: dropdown < sticky < banner < overlay/backdrop < modal < popover < toast < tooltip. v0's ladder matches; add `banner`, `hide`. Values are defaulted constants; only _order_ is contractual.
- **Breakpoints:** Tailwind `sm..2xl`, Bootstrap `sm..xxl`, Carbon `sm..max`, M3 window classes (`compact/medium/expanded/large`). Universal = ordinal keys with per-DS values; **catalog owns the keys, never the values**. M3's window classes are aliases onto ranges.
- **Interaction states:** the union across all systems is `rest`(default/enabled) · `hover` · `active`(pressed/down) · `focus`(key-focus/focus-visible) · `selected`(checked/on) · `disabled` · `visited`. Base UI's `data-*` attributes and Panda's `_hover` conditions are _encodings_ of the same set. M3's state _layers_ (fixed-alpha overlays: 8/12/12/16%) are a **derivation mechanism** for state values, not extra state names.

### 2.9 The smallest universal concept set

Ten concepts span everything surveyed:

1. **Three tiers**, semantic as the binding surface (T1).
2. **The role grid**: role × prominence(`tint|outline|solid|text`) × state(`rest|hover|active|focus|selected|disabled`) + on-colors for `solid`/`tint` (C1).
3. **Role archetypes** (`brand|status|neutral`) so _custom_ roles derive and export like built-ins (C2).
4. **The elevation ladder** with per-level projections {surface, shadow, z-band, tint} (E1).
5. **Content hierarchy**: strong/default/muted/subtle + disabled/inverse + link (X1).
6. **Ordinal scales with declared progressions** for space/size/radius/border-width (S1).
7. **Composite type roles** over primitive scales (TY1).
8. **Motion pair**: duration ordinal × easing set incl. spring (M1).
9. **Mode dimensions** for scheme, density/platform, contrast, motion-preference (already v0's mechanism; needs reserved names).
10. **Named ladders** for z and breakpoints where order is the contract, values are defaults.

Everything any surveyed system expresses is a _projection_ of these ten; everything the ten express can be _sampled back_ into any surveyed system. That is the definition of an interlingua.

---

## 3. The redesigned catalog

### 3.1 The role grid (replaces-by-refounding the five-position scale)

Canonical form: `semantic.color.<role>.<prominence>.<state>` with on-colors `semantic.color.<role>.on-<prominence>`.

```
prominence →   tint          outline        solid          text
state ↓        (bg wash)     (border wash)  (max fill)     (role as fg)
rest           tint          outline        solid          text
hover          tint-hover    outline-hover  solid-hover    text-hover
active         tint-active   outline-active solid-active   text-active
selected       tint-selected —              solid-selected —
disabled       (mechanism: see §5.5)
on-colors      on-tint       —              on-solid       —
extra tones    tint-deep¹    —              —              text-strong²
```

¹ `tint-deep` = Chakra `emphasized` / Radix 5-as-tone; ² `text-strong` = Radix 12 / high-contrast.

**Original posture (historical — see the status note above): v0 names become permanent aliases.** As amended, this table is the _migration rename table_ instead — old names are removed, not kept:

| Old slot (removed, not kept)                   | Revised canonical                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `<role>.base`                                  | `<role>.solid.rest`                                                                                                           |
| `<role>.hover` / `.active`                     | `<role>.solid.hover` / `.active`                                                                                              |
| `<role>.subtle`                                | `<role>.tint.rest`                                                                                                            |
| `<role>.contrast`                              | `<role>.text.strong`                                                                                                          |
| `text-on-<role>.base`                          | `<role>.on-solid`                                                                                                             |
| `text-on-<role>.subtle`                        | `<role>.on-tint`                                                                                                              |
| _(new, was Bootstrap-exporter convention F10)_ | `<role>.outline.rest` = `mix(solid.rest, surface, 0.70)`                                                                      |
| _(new)_                                        | `<role>.text.rest` = AA-anchored role-as-foreground (numerically ≈ `on-tint` on most systems; the distinct slot is the point) |

Derivation: the grid is filled by generalizing the existing standard@1 rules — the state deltas apply _per prominence column_, the tint/outline mixes are the F10/F21-pinned formulas, `on-*` use the ratified contrast-pick/on-brand-walk. Authored values always win, per cell. Cost control: exporters _pull_ cells; derivation is lazy per requested cell, so the grid does not inflate build output for targets that sample three cells.

**Why this is the right abstraction and not over-engineering:** three shipped exporters already needed cells the previous catalog lacked (F10 border tints; Bootstrap `-text-emphasis` semantics; Storybook `Selected` chrome vars fell back to conventions), Radix Themes — the next B3 target — _cannot be exported at all_ without the full grid (its 12 steps are the grid), and component-library variant translation (§5.6) becomes table lookup instead of per-exporter invention.

### 3.2 Elevation ladder

`semantic.elevation.<level>` for levels `0..5`, each projecting `surface`, `shadow`, `z-band`, optional `tint`. Aliases (permanent): `background` = `elevation.0.surface`, `surface` = `elevation.1.surface`, `surface-raised` = `elevation.2.surface`, `overlay` = `elevation.3.surface`; `shadow.{sm,md,lg,xl}` = `elevation.{1,2,3,4}.shadow`. `scrim` stays separate (a veil is not a level — F2 holds). Mappings: Carbon `layer-01..03` → levels 1–3; M3 `surface-container-{lowest..highest}` → 0–5 with `surface-tint` via the level tint; Chakra `bg.panel` → 1. Dark-mode rule: `raise()` applies per level (the existing rule, now indexed).

### 3.3 Content hierarchy

`text.strong` (new) · `text` · `text-muted` · `text-subtle` (new: placeholder/helper) · `text-disabled` (new, mechanism §5.5) · `text-inverse` (new: the F15 cross-mode read, now a real slot) · `link.{rest,hover,visited}` (new; v0 exporters derived link from primary — that stays the _rule_, the _slot_ becomes addressable).

### 3.4 Scales, type, motion, ladders (deltas only)

- `space.*` unchanged; add semantic aliases already specced (`inset/stack/gap`).
- **New** `size.control.{sm,md,lg}` (Ant `controlHeight`, Mantine/Chakra sizes) — the one component-adjacent dimension every library needs pre-v2.
- `radius.*` unchanged; add family aliases `radius.{control,field,container}` (daisyUI's insight, default = `md`).
- Type: primitives unchanged; **new** composite roles `type.{display,heading,title,body,label,code}.{sm,md,lg}` (DTCG `typography` values).
- Motion: add `easing.spring` (Open Props/M3-Expressive); document `decelerate`≡enter, `accelerate`≡exit.
- Z: add `banner`, `hide`. **New** `breakpoint.{xs,sm,md,lg,xl,2xl}` — keys contractual, values defaulted (Tailwind's, the de-facto standard) unless authored.
- **Reserved mode dimensions**: `color-scheme`, `density` (`compact|comfortable|spacious`), `contrast` (`standard|more`), `motion` (`full|reduced`), `platform` (`desktop|touch`). Only names are reserved; all remain optional.

### 3.5 Canonical naming rules (normative)

kebab-case; singular; no abbreviations; ASCII; grid order is `family.role.prominence.state`; ordinal scale keys are t-shirt (`xs..4xl`) for human scales and integers for option ramps; `on-` prefix exclusively for on-colors; no component nouns in the semantic tier (that's tier 3); numbers never encode meaning in the semantic tier (Radix's `9` is our `solid` — meaning over position).

---

## 4. Aliasing, archetypes, inheritance, extensions

### 4.1 Binding (unchanged, reaffirmed)

The Cathode pattern is the universal adoption mechanism: DS keeps its vocabulary as custom semantic tokens; a bindings layer aliases catalog slots to it. The study strengthens the rule _bind by meaning, not spelling_ with the §2.2 false-friends registry as normative appendix.

### 4.2 Role archetypes (new)

```jsonc
"crt-amber": { "$type": "color", "$value": "{option.crt.amber}",
  "$extensions": { "transtyle.role": { "archetype": "status" } } }
```

A custom role declaring an archetype gets the **full grid derived** and is exported wherever a target has open role slots (daisyUI custom theme colors, Chakra colorPalette, Tailwind theme extension) and reported `dropped` where it doesn't (Bootstrap's closed set). Archetypes: `brand`, `status`, `neutral`. This makes the catalog _open_ without sacrificing derivability — the single biggest agnosticism win over the previous catalog.

### 4.3 Inheritance

Explicit and shallow, in resolution order: (1) grid cells inherit from their `rest` row, then from the role's `solid.rest`; (2) mode values inherit from default mode (unchanged rule); (3) component-tier tokens (v2) inherit from a declared semantic slot: `component.button.radius = inherits(radius.control)` — carried now, resolved in v2 so tier-3 never invents values, only overrides them. Provenance records every hop.

### 4.4 Extension points

`$extensions.transtyle.*` namespaces (existing) + three new: `transtyle.role` (archetype, above); `transtyle.state-mechanism` (`"layer"` — M3 state-layer alpha compositing as an alternative _derivation mechanism_ for grid state cells: `hover = overlay(on-solid @ 8%)`); `transtyle.vendor.<ecosystem>` for lossless round-trip baggage (e.g. importing M3 keeps `surface-tint`; importing Carbon keeps layer-scoped border sets) — carried, re-emitted by the matching exporter, ignored by all others.

---

## 5. Conversion strategies (per ecosystem)

Direction **out** (catalog → target); **in** (importer) noted where shapes differ. `≈` marks `approximated`.

| Target                                                 | Strategy                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Radix Themes**                                       | grid → steps: 1←`elevation.0.surface` 2←`neutral.tint.rest`≈ 3/4/5←`tint.{rest,hover,active}` 6←`outline.rest`(soft)≈ 7/8←`outline.{rest,hover}` 9/10←`solid.{rest,hover}` 11/12←`text.{rest,strong}`. Full-rank both ways — the grid's litmus test. **In:** exact inverse.                                  |
| **Material 3**                                         | `solid.rest`→`primary`, `on-solid`→`on-primary`, `tint.rest`→`primary-container`, `on-tint`→`on-primary-container`; elevation ladder→levels; type roles→typescale; states→state layers via `state-mechanism: layer` (else bake literals ≈). `tertiary`: from a third brand role if authored, else `dropped`. |
| **Ant Design v5**                                      | grid→map tokens 1:1 (`Bg/BgHover/Border/BorderHover/Hover/base/Active/Text*`); note Ant's solid-hover is _lighter_ — exporter flips the delta sign, documented, still `native`. Seeds← authored slots for round-trip.                                                                                        |
| **Fluent 2**                                           | `solid.{rest,hover,active,selected}`→`BrandBackground{,Hover,Pressed,Selected}`; `text.*`→`BrandForeground`; `outline`→`BrandStroke`; content ladder→`NeutralForeground1..4`; elevation→`NeutralBackground1..6`+shadow ramp.                                                                                 |
| **Carbon v11**                                         | elevation→`background`+`layer-01..03`; content ladder→`text-*`; status→`support-*`; `interactive`←`primary.solid.rest`; per-layer border sets from vendor extension or `outline` ≈.                                                                                                                          |
| **Chakra/Panda**                                       | grid→`colorPalette.{solid,contrast,fg,subtle,muted,emphasized}` + semanticTokens with `_dark` conditions from the mode matrix.                                                                                                                                                                               |
| **Mantine/variant libs**                               | variant table: `filled←solid` `light←tint` `outline←outline` `subtle←text(+tint hover)` `transparent←text`; 10-step scale synthesized from grid ≈ (documented quantization).                                                                                                                                 |
| **Tailwind**                                           | semantic→`@theme` variables (v4) or config (v3); option ramps pass through; grid exposed as utility-consumable variables.                                                                                                                                                                                    |
| **shadcn / daisyUI / Bootstrap / ECharts / Storybook** | shipped mappings unchanged — each is re-derivable from the grid via the §3.1 alias table (regression guarantee: byte-identical output, testable).                                                                                                                                                            |
| **Spectrum**                                           | states `{default,hover,down,key-focus}`←`{rest,hover,active,focus}`; platform scale←`platform` mode; t-shirt quantization ≈.                                                                                                                                                                                 |

**Import strategies** (Phase 3, unchanged in principle): every "in" mapping is the transpose, with import coverage mirroring export coverage; vendor extensions carry the untranslatable remainder for round-trip.

---

## 6. Worked translations (one decision, six ecosystems)

Specimen: Acme's single authored brand `oklch(0.55 0.18 255)` (#026fd7), light mode; every value below is engine-derivable today or by the §3.1 rules (values shown for the already-implemented cells are the real engine outputs; grid-new cells marked _new_).

| Grid cell                    | Value              | → shadcn                 | → Bootstrap         | → Radix step | → Ant map             | → M3                   | → Chakra palette |
| ---------------------------- | ------------------ | ------------------------ | ------------------- | ------------ | --------------------- | ---------------------- | ---------------- |
| `primary.solid.rest`         | `#026fd7`          | `--primary`              | `$primary`          | 9            | `colorPrimary`        | `primary`              | `solid`          |
| `primary.solid.hover`        | `#005fc6`          | _(css hover)_            | `$link-hover-color` | 10           | `colorPrimaryActive`¹ | state layer 8%         | —                |
| `primary.on-solid`           | `#ffffff`          | `--primary-foreground`   | btn text (Sass)     | —            | —                     | `on-primary`           | `contrast`       |
| `primary.tint.rest`          | `#e7effa`          | _(accent/muted pattern)_ | `-bg-subtle`        | 3            | `colorPrimaryBg`      | `primary-container`    | `subtle`         |
| `primary.on-tint`            | `#005bb6`          | _(accent-foreground)_    | `-text-emphasis`    | —            | —                     | `on-primary-container` | —                |
| `primary.outline.rest` _new_ | `#b7d2f4`          | —                        | `-border-subtle`    | 7            | `colorPrimaryBorder`  | —                      | —                |
| `primary.text.rest` _new_    | ≈`#005bb6`         | —                        | _(links)_           | 11           | `colorPrimaryText`    | —                      | `fg`             |
| `primary.text.strong`        | `#171b20`-anchored | —                        | —                   | 12           | —                     | —                      | —                |

¹ Ant's lighter-hover: the exporter maps `hover`→`colorPrimaryHover` with sign-flipped delta and `rest→colorPrimary`, `active→colorPrimaryActive`.

Same table, Cathode (`primary = crt.ink`, dark-native): every column re-derives green with **zero markup changes** in any target — the demo projects are the standing proof for three of these columns today; the grid extends the proof to Radix/Ant/M3 the day those exporters exist.

**Loss analysis (what cannot round-trip, by design):** M3 state-layer _mechanics_ (representable via `state-mechanism`, else baked ≈); Carbon per-layer border sets (vendor extension); Spectrum component-tier tokens (deferred to v2); Radix P3/alpha variants (gamut-flagged ≈); Tailwind arbitrary values (not tokens). Each lands in coverage as `approximated`/`dropped` with the reason — loss is _measured_, never silent.

---

## 7. Migration & sequencing

1. **Superseded by ADR-0010** (original posture, kept for the record): this section originally proposed a non-breaking landing — additive minor, `standard@1` frozen, grid rules as a new `standard@2` rule-pack version. **As decided:** Transtyle is unreleased, so none of that applies. The catalog is revised in place as a breaking change; `standard@1` keeps its id and is redefined in place; no version number moves. See [docs/plan/catalog-revision.md](../plan/catalog-revision.md) for the actual landing sequence (tasks T1…T11).
2. Land order (as actually executed, per the plan): (a) rewrite ir.md's catalog section directly (T1); (b) engine implements the grid rules under `standard@1`, redefined (T2); (c) all exporters/examples/fixtures/demos migrate to the new names in the same window, with a dead-vocabulary guard preventing old names from surviving anywhere (T3); (d) exporters adopt remaining grid cells opportunistically; (e) Radix Themes exporter becomes the grid's acceptance test (T9, consumes all 12 columns); (f) archetypes (T7) + reserved modes (T8); (g) importers (Phase 3) use the transposed tables.
3. The Phase 0 exercise protocol applies again once the freeze re-arms (first npm publication): each new exporter = a probe of the grid; two consecutive clean attempts before the catalog is declared frozen. Until then, the grid can still change in place if a real gap is found — pre-release, that's a fix, not a break.

## 8. Open questions

- `selected` for `outline`/`text` columns: real usage exists (Fluent) but sparse — derive-on-demand or reserve?
- Should `tint-deep` (Chakra `emphasized`, Radix 5-as-tone) be canonical or an alias of `tint.active`? (Numerically near; semantically "a deeper tone", not "being pressed".)
- Second neutral family (M3 `neutral-variant`) — archetype `neutral` twice vs a dedicated slot.
- Breakpoint _values_: default to Tailwind's or refuse to default (author-or-silent-absence)?

---

_Appendix A — false friends registry (normative for exporter reviews): the §2.2 and §2.5 tables._
_Appendix B — state-name synonym table: rest=default=enabled · active=pressed=down · focus=key-focus=focus-visible · selected=checked=on._
