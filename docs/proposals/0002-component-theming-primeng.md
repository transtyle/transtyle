# Proposal 0002 — Component-tier tokens, using PrimeNG as the forcing function

**Status: DRAFT — analysis only, no implementation yet.** This document answers "what would Transtyle need in order to support PrimeNG," and doubles as the v2 component-tier RFC that [ADR-0003](../adr/0003-tokens-first.md) and [component-layer.md](../specs/component-layer.md) said would happen "from evidence" once a real exporter's component-theming needs existed. PrimeNG is that evidence.

**What Transtyle needs to *produce* is a preset** (`definePreset`-shaped: `{ primitive?, semantic, components }`), not a theme override layered on top of one — confirmed against the actual [`presets/aura`](https://github.com/primefaces/primeng/tree/master/packages/themes/src/presets/aura) source tree (~90 component folders) and the live customization docs (`primeng.org/theming`, fetched 2026-07-21, updated below with the full picture). §5 addresses directly how that scale is made tractable rather than requiring ~90 hand-written mapping tables.

**Standing constraint, restated:** Transtyle's catalog exists to be the *best agnostic representation of the whole ecosystem* — design systems and component libraries, as both import and export targets — never a translation of one target's internals wearing a neutral-sounding name. Proposal 0001 (the role grid) only shipped after a ~14-ecosystem comparative study specifically to avoid "a shape reverse-engineered from shadcn or Bootstrap"; that same discipline applies here. §2.8 does a first cross-check against a second ecosystem (Adobe Spectrum) and it already changes §3/§6's conclusions — this document is **not** yet at proposal-0001's evidentiary bar, and says so explicitly where that matters.

## 1. Why PrimeNG, and why now

Every reference exporter shipped so far (shadcn, Bootstrap, daisyUI, ECharts, Storybook, css-variables, Radix) binds **at the semantic tier only** — the "exporters bind to the semantic tier" rule in [ir.md](../architecture/ir.md#the-three-tier-token-model). That rule has held because none of those targets *require* per-component tokens to look correct: Bootstrap's `$btn-*` variables are a handful of conventions layered informally on top of `$primary` etc.; shadcn's components read CSS variables that are themselves semantic-tier.

PrimeNG is different in kind, not just degree: it ships an explicit, first-party, three-tier **design token system** (`primitive` → `semantic` → `components`), documented as such, with ~90 components each carrying their own token namespace. It is the first target where "bind at the semantic tier" is not just insufficient but actively wrong — PrimeNG's own docs tell integrators to use component tokens "when customizing a specific component" as a matter of design philosophy. Supporting it properly means actually building the reserved-but-inert `component.*` tier ([ir.md line 25](../architecture/ir.md#the-three-tier-token-model): "RESERVED for v2 — parsed, carried, unused") into something exporters can read.

This is exactly the situation [ADR-0003](../adr/0003-tokens-first.md) anticipated and gated: v2 component work is deferred until it can be "designed from evidence: real exporters' hand-written component-theming prototypes, not a priori abstraction." **This proposal treats a PrimeNG exporter as that prototype**, not as jumping the gate.

## 2. PrimeNG's actual architecture (verified against source, not just docs prose)

Fetched live from `github.com/primefaces/primeuix` (the theme package backing PrimeNG ≥19; PrimeNG itself now just re-exports it) — `packages/themes/src/presets/aura/base/index.ts` and `.../aura/button/index.ts`, 2026-07-21.

### 2.1 Primitive tier
Raw palette: 17 hue families (`emerald`, `green`, `lime`, `red`, `orange`, `amber`, `yellow`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `slate`, `gray`, `zinc`, `neutral`, `stone`) × 11 steps (`50`–`950`) — no context, exactly Transtyle's `option.*` tier. Also a primitive **size** scale: `borderRadius.{none,xs,sm,md,lg,xl}` — six named radius steps with no semantic meaning yet.

### 2.2 Semantic tier — global
Small scalar tokens (`transitionDuration`, `disabledOpacity`, `iconSize`, `anchorGutter`), a `focusRing` **composite** at two levels (a base default, plus a `formField`-scoped override — see below), and, per `colorScheme.{light,dark}`:

- **`primary.{color,contrastColor,hoverColor,activeColor}`** — maps exactly onto `primary.solid`/`on-solid`/`solid-hover`/`solid-active`. Direct 1:1, no gap.
- **`primary.{50..950}`** and **`surface.{0,50..950}`** — two full **11-step numeric ramps** (brand and neutral respectively), not just an anchor color. This is a real, structural mismatch with the role grid, which has ~16 *named* cells (`solid`, `tint`, `outline`, `text`, …), not 11 arbitrary numbered stops — see §2.6.
- **`highlight.{background,focusBackground,color,focusColor}`** — selected/active-item styling (used by menus, list options, tabs). Maps onto `primary.tint`/`tint-hover`/`on-tint`-ish territory.
- **`mask.{background,color}`** — the modal/drawer backdrop. **Maps exactly onto Transtyle's existing `scrim` token** — already in the catalog, zero gap.

### 2.3 Semantic tier — shared by component *class* (the part with no Transtyle equivalent yet)
This is the finding that matters most, and it's bigger than initially scoped below — confirmed directly from `primeng.org/theming`'s "Forms" customization example ("The design tokens of the form input components are derived from the `form.field` token group... any component that depends on this semantic token... would receive the change") and from the full `aura/base` source. PrimeNG's `semantic` object carries **five** such shared groups, not two:

- **`formField.*`** — richest of the five: `paddingX`/`paddingY` (+ `sm`/`lg`), `borderRadius`, its own `focusRing` override, `transitionDuration`, plus per-mode `background`, `disabledBackground`, three *filled-state* backgrounds, `borderColor`/`hoverBorderColor`/`focusBorderColor`/`invalidBorderColor`, `color`/`disabledColor`/`placeholderColor`/`invalidPlaceholderColor`, float-label color variants, `iconColor`, `shadow`. Read by Button, InputText, Select, Checkbox, DatePicker, and every other form-adjacent component.
- **`list.*`** — `padding`, `gap`, `header.padding`, `option.padding`/`option.borderRadius`, `optionGroup.*`. Read by Listbox, Select's panel, AutoComplete's dropdown, etc.
- **`navigation.*`** — a *second*, distinct list-shaped group (`list.padding/gap`, `item.padding/borderRadius/gap`, `submenuLabel.*`, `submenuIcon.size`) for menu/nav components (Menu, Menubar, TieredMenu, PanelMenu, Breadcrumb) — PrimeNG itself distinguishes "I am an option list" from "I am a navigation menu" even though both are visually list-like.
- **`overlay.{select,popover,modal,navigation}`** — `borderRadius`/`padding`/`shadow` per floating-surface *kind*. Maps directly onto `elevation.N.surface` (pick the level per kind) + the existing `radius.*` family + the existing `elevation.N.shadow` **composite type** — Transtyle already has the right shape here (a shadow composite), just needs the exporter to pick the right elevation level per overlay kind.
- **`content.*`** (Card/Panel-style containers) + **`text.{color,hoverColor,mutedColor,hoverMutedColor}`** — map onto `elevation.*.surface`/`border`/`text.base`/`text.muted`, plus two small **real gaps**: PrimeNG wants *hover* variants of plain content color and muted text color that the role grid doesn't currently define for `text.*` (it does for role-colored `text` cells, e.g. `primary.text-hover`, but not for the content-hierarchy `text.base`/`text.muted` rungs themselves). Small, additive, uses the same `state-delta` derivation helper already in `derive.js` — not a redesign.

PrimeNG doesn't name this a fourth tier — it's still nominally "semantic" — but functionally it is a **component-archetype layer**: a named bundle of tokens shared by every component that plays the same structural role, sitting between the flat semantic catalog and 90 independent component namespaces. Without it, a PrimeNG exporter would duplicate padding/radius/focus-ring/border logic across ~20+ components instead of five groups.

### 2.4 Component tier
Per component, tokens are organized as **`root` (dimensional: radius, gap, padding, sizes) + `colorScheme.{light,dark}.<variant>.<severity>.<state>.<part>`**. For Button (`aura/button/index.ts`):

- **variant** — `root` (filled), `outlined`, `text`, `link`
- **severity** — `primary`, `secondary`, `success`, `info`, `warn`, `help`, `danger`, `contrast`, (+ `plain` for outlined/text only)
- **state** — rest / `hover*` / `active*` (prefixed onto each part: `background`/`hoverBackground`/`activeBackground`)
- **part** — `background`, `borderColor`, `color`, `focusRing.color`

That is a **4-dimensional grid per component**: variant × severity × state × part. And critically:

**Variant maps almost 1:1 onto Transtyle's existing prominence axis** (`root`↔`solid`, `outlined`↔`outline`, `text`↔`text`), **severity maps almost 1:1 onto `COLOR_ROLES`**, and **state maps exactly onto the grid's interaction-state axis**. Concretely, in the *default* Aura preset, `button.colorScheme.light.root.primary.background` = `{primary.color}` = (in Transtyle terms) `primary.solid`; `.hoverBackground` = `primary.solid-hover`; `.outlined.primary.borderColor` = `primary.200`-ish tint = `primary.outline`; `.text.primary.color` = `primary.color` = `primary.text`-adjacent. **The role grid already is the shape PrimeNG's component color tokens want.** This is the single biggest finding: most of PrimeNG's per-component color surface needs *no new Transtyle catalog concept* — it needs an exporter mapping table, the same pattern every other exporter already uses.

### 2.5 Where PrimeNG's defaults *don't* route through the brand (a real gap to design around, not to copy)
In Aura's shipped preset, only `primary`/`secondary`(via the gray ramp)/`contrast` route through `semantic.primary`; `info`/`success`/`warn`/`help`/`danger` are **hardcoded to specific primitive families** (`sky`, `green`, `orange`, `purple`, `red`) rather than derived from the brand color. Transtyle's own `derive.js` already does better here — `success`/`warning`/`danger`/`info` all hue-anchor off `primary.solid` by default (`docs/architecture/derivation.md`). A Transtyle→PrimeNG exporter should **not** reproduce PrimeNG's hardcoding; it should feed PrimeNG's severity tokens from Transtyle's already-brand-coherent role grid. This is a case where Transtyle's model is strictly better than the target's own default, and the exporter should say so in its `usage.md`, the same honesty pattern already used elsewhere (e.g. Cathode's worklog noting derived `info` is "conventionally blue — coherent, wrong for the aesthetic").

### 2.6 The ramp-shape mismatch, and why it's already solved
`primary`/`surface` want 11 numbered steps (`50`–`950`); the role grid has ~16 *named* cells (§2.2). **This is the exact problem the Radix exporter already solved** — Radix wants 12 numbered steps per role, and the exporter (`packages/exporter-radix/src/index.js`) projects the grid onto them, computing the 2 steps with no direct cell via a fresh `ctx.mix`. A PrimeNG ramp projector is the same technique with a different step count and mix ratios — not new engineering, a second application of code that already exists and already works. This is the central fact behind §5's tractability argument.

### 2.7 The `extend` escape hatch — where custom archetype roles surface
`definePreset` supports an `extend` block per component (and globally) for tokens outside the fixed schema — PrimeNG's own documented example adds a `button.accent.color` token plus a companion `.p-button-accent` CSS rule via `css: ({ dt }) => ...`. **This is exactly where a Transtyle custom archetype role (T7) should land**: a design system that authors `semantic.color.help` (or any other non-built-in role) with the `transtyle.role` extension gets it exported into PrimeNG's `components.button.extend.help.*` + a matching `.p-button-help` CSS rule, generated the same way daisyUI's exporter already emits `--color-<name>` for archetyped roles. No PrimeNG-side gap — their own extensibility model already has a slot for this.

### 2.8 Agnosticism check — a second ecosystem, and what it changes

Proposal 0001 studied 14 ecosystems for the *color role grid* and explicitly **deferred component-tier depth** ("Spectrum component-tier tokens (deferred to v2)"). That means §2.3's `formField`/`list`/`navigation`/`overlay` grouping has so far been checked against exactly **one** ecosystem — precisely the failure mode the agnosticism principle exists to catch. A spot-check against Adobe Spectrum (`adobe/spectrum-design-data`, `packages/tokens/src/layout.json`, fetched 2026-07-21) — the system proposal 0001 itself flagged as having "the heaviest component tier in the industry" — surfaces a real difference, not just confirmation:

**Spectrum does not group tokens into a small number of shared named objects the way PrimeNG does.** Instead it defines a large, flat list of precisely-named, per-context dimension tokens — `accessory-gap-{size}`, `accessory-item-padding-{size}`, `base-gap-{size}`, `banner-padding-horizontal-compact`, one entry per component-or-context × t-shirt size × (sometimes) density variant. There is no single `formField.paddingX` a dozen components alias into; there's a much larger vocabulary of specific names, each usually an alias onto the shared numeric spacing scale.

**What this changes:**
- The `field`/`list`/`navigation`/`overlay` groups (§2.3, §4) are **not confirmed as universal vocabulary** — they may be PrimeNG's (and plausibly Chakra/Panda's "recipe" style) particular architectural choice, not a convergent industry pattern the way the color role grid was. Downgrade their status in §3 accordingly: proposed, single-source, pending real cross-ecosystem study.
- This does **not** invalidate the strategy, because Transtyle's internal catalog shape was never required to mirror any one target's internal shape — only to be mappable to and from it. The five groups can ship as **default-providing aliases** (`component.<name>.<part>` still resolves from them when unauthored, per `component-layer.md`'s existing "component tokens default from semantic tokens" rule) while the **real per-component `component.*` tier** — not the archetype groups — is what accommodates an ecosystem like Spectrum that wants finer, per-context tokens the shared groups don't capture. The archetype groups are a convenience default for ecosystems that converge on them; they are not load-bearing for ecosystems that don't.
- The honest scope statement: this document has PrimeNG-depth evidence and a Spectrum spot-check, not proposal-0001-depth (14-ecosystem) evidence. §6 now sequences a real comparative pass (Material 3, Chakra/Panda recipes, Fluent 2, Ant Design v5 — all already enumerated in proposal 0001's ecosystem list, just not yet studied at component-tier depth) before any new semantic vocabulary is committed, not after.

## 3. Gap analysis — what Transtyle's language actually needs

Ranked by how novel each requirement is, cheapest first:

| # | Need | Verdict |
|---|---|---|
| 1 | Map PrimeNG's `variant`/`severity`/`state`/`part` grid to `semantic.color.<role>.<cell>` | **No new tokens.** A mapping table in a new `@transtyle/exporter-primeng`, same shape as every existing exporter's `MAPPING`/`COLOR_MAPPING` table. |
| 2 | `help` severity (and any DS-specific extra severity) | **Solved already, by T7 + PrimeNG's own `extend` mechanism (§2.7).** No engine change needed — this was literally built for this kind of case. |
| 3 | `contrast` severity | **No new tokens**, a mapping decision: PrimeNG's `contrast` is the near-black/near-white extreme (`surface.950` light / `surface.0` dark) — maps cleanly onto `neutral.text-strong` (light) / the dark-mode neutral extreme, both of which already exist. |
| 4 | `primary`/`surface` 11-step numeric ramps | **No new tokens, reused engineering.** Project the grid onto 11 steps the same way `exporter-radix` already projects it onto 12 — see §2.6. |
| 5 | Component-archetype groups (`formField`, `list`, `navigation`, `overlay`, `content`) | **New, small, derivation-only aliases — but single-source pending confirmation (§2.8).** Verified against PrimeNG only; a Spectrum spot-check shows a materially different (flatter, more granular) strategy for the same problem. Ship as *default-providing* aliases, not as claimed-universal vocabulary, until a proper multi-ecosystem pass (§6) either confirms or reshapes them. |
| 6 | Hover variants of `text.base`/`text.muted` | **New, tiny.** One more `state-delta` derivation call each, the exact pattern already used for `primary.text-hover` etc. |
| 7 | Size variants (`sm`/`lg`) per component | **Reuse an existing pattern, don't invent one.** The catalog already has exactly this shape for typography: `semantic.type.role.<role>.<size>` (`docs/architecture/ir.md`). Component tokens should follow the identical `component.<name>.<size>.<part>` convention rather than a new mechanism. |
| 8 | `focusRing` as a 5-field composite (width/style/color/offset/shadow) vs. Transtyle's flat `ring` color | **Defer — don't add a DTCG composite yet.** Transtyle already has precedent for composite types when a real need forces it (`shadow` for `elevation.N.shadow`). But a single exporter needing 4 more scalar fields around one existing color doesn't clear that bar alone — bind `ring` for the color, let the PrimeNG exporter hardcode `width`/`style`/`offset` as its own reasonable constants (same trade-off Bootstrap's exporter already makes for `$focus-ring-color` at "conventional alpha .25"). Revisit if a *second* component-heavy exporter (MUI, Chakra) independently needs the same 5 fields — that's the actual bar this project already uses elsewhere ("two consecutive... before the catalog is declared frozen," ADR-0010). |
| 9 | Primitive radius scale (`none`/`xs`/`sm`/`md`/`lg`/`xl`) | **No new tokens.** Maps onto the existing `radius.{control,field,container}` family plus the catalog-default `radius.md`; the exporter just needs a translation table (`none→0`, `xs→border-width-ish`, …), same as Bootstrap's `xxl = xl × 2` convention already does for a mismatched scale. |
| 10 | The `component.*` tier itself | **Build it.** It's specced (`component-layer.md`) and reserved in the schema, but nothing resolves, validates, or derives it today. This is the real engineering lift — see §5. |

## 4. Proposed new semantic vocabulary (the actually-new part)

Five groups, all derivation-only (an empty override compiles today and forever, per `component-layer.md`'s existing principle) — every value below is an *alias* of something already in the catalog, not a new primitive:

```jsonc
"semantic": {
  "field": {                          // NEW — every form-adjacent component (button, input, select, checkbox, ...)
    "padding-x": { "$value": "{space.4}" },  "padding-y": { "$value": "{space.2}" },
    "radius":    { "$value": "{radius.field}" },
    "border":       { "$value": "{border}" },        "border-hover": { "$value": "{neutral.outline-hover}" },
    "border-focus": { "$value": "{primary.solid}" },  "border-invalid": { "$value": "{danger.solid}" },
    "text": { "$value": "{text.base}" },  "text-disabled": { "$value": "{text.disabled}" },
    "placeholder": { "$value": "{text.muted}" },
    "sm": { "padding-x": {...}, "padding-y": {...} }, "lg": { "padding-x": {...}, "padding-y": {...} }
  },
  "list": {                           // NEW — option-picker components (listbox, select-panel, autocomplete)
    "padding": { "$value": "{space.1}" },  "gap": { "$value": "{space.0}" },
    "option-padding": { "$value": "{space.2} {space.3}" },  "option-radius": { "$value": "{radius.control}" }
    // hover/selected backgrounds are NOT new — alias primary.tint / primary.tint-hover, already in the grid
  },
  "navigation": {                     // NEW — menu-shaped components (menu, menubar, tiered-menu, breadcrumb)
    "item-padding": { "$value": "{space.2} {space.3}" },  "item-radius": { "$value": "{radius.control}" },
    "item-gap": { "$value": "{space.2}" }
  },
  "overlay": {                        // NEW — floating surfaces, one elevation level per kind
    "popover":  { "surface": { "$value": "{elevation.2.surface}" }, "shadow": { "$value": "{elevation.2.shadow}" } },
    "modal":    { "surface": { "$value": "{elevation.3.surface}" }, "shadow": { "$value": "{elevation.3.shadow}" } }
  }
  // "content" (Card/Panel) needs no new group — elevation.1.surface + border + text.base already cover it.
}
```

That's the whole new-vocabulary surface. Everything else PrimeNG's semantic tier wants (`primary`/`surface` ramps, `mask`, `highlight`, `focusRing`) already exists in the catalog or is a ramp-projection problem (§2.6), not a new-token problem.

## 5. How the exporter makes ~90 components tractable (the direct answer to "we must support this complexity")

The output artifact is a **preset**, generated as a `definePreset(Base, overrides)` call — confirmed as PrimeNG's own recommended shape for anything short of "keep 100% of Aura's own defaults." Two things make covering all ~90 components tractable *engineering*, not ~90 hand-authored mapping tables:

**5.1 — Override a base preset; don't author one from zero.** `definePreset(Aura, { semantic: {...}, components: {...} })` deep-merges: any token Transtyle doesn't emit, PrimeNG fills from `Aura` (or whichever built-in the user picks as `options.base`). This is exactly the strategy already shipped for the Radix exporter ("override an existing preset" rather than build one from scratch) — same trade-off, same honesty story: coverage reporting shows what Transtyle actually drove vs. what's inherited from the base preset untouched.

**5.2 — One generic severity-grid mapper, applied across every component that has the shape, not ~90 bespoke tables.** §2.4 already established that `variant × severity × state × part` is isomorphic to `prominence × role × state × cell`. Concretely: write **one function** `mapSeverityGrid(map, { variants, parts })` that, given a component's variant list (most have `root`/`outlined`/`text`, some fewer) and part list (`background`/`borderColor`/`color`, sometimes `+icon`/`+focusRing`), emits `colorScheme.<mode>.<variant>.<severity>.<part>` for every `severity` in `COLOR_ROLES` (+ any archetyped custom roles, §2.7) by reading `semantic.color.<role>.<cell>` — the same cell-name translation the Radix exporter already does (`solid↔root`, `outline↔outlined`, `text↔text`, `on-solid↔contrast`). Apply that one function against a **per-component descriptor table** — not a value table, a *shape* table (`{ button: { variants: [...], parts: [...] } }`, `{ tag: {...} }`, `{ badge: {...} }`, …) — for every component that follows the severity-colored pattern (a first pass through the ~90 confirms this is likely 25–35 of them: Button, Tag, Badge, Message, InlineMessage, ProgressBar, Checkbox, RadioButton, ToggleSwitch, SelectButton, Slider, Knob, Rating, Chip, …). The remaining ~55–65 components are structural (DataTable, Galleria, Timeline, Splitter, Tree, …) with little or no severity-colored surface — those get their non-color dimensional tokens (padding/gap/radius) from the five archetype groups in §4 and need little to no bespoke per-component work either.
**Net result:** the ~90-component surface decomposes into (a) one generic color-grid mapper, (b) ~90 small *shape descriptors* (a few lines each — which variants/parts a component exposes), and (c) a genuinely small residue of components with real bespoke needs (DataTable's row-striping, Galleria's indicators). That residue, not the full 90, is the real hand-authored work.

**5.3 — What building `component.*` requires beyond the exporter** (squarely v2/Phase 4 per the existing roadmap gate — listed for completeness, not as a commitment to build it now):

1. **`packages/ir`**: a `COMPONENT_CATALOG` constant (the component list `component-layer.md` sketches, extended per §5.2's descriptor shape) — per component, its variant/part shape and which semantic-tier group(s) it defaults from.
2. **`packages/core/src/normalize.js`/`derive.js`**: actually resolve `component.*` tokens instead of "parsed, carried, unused" — an empty `component` tier must still compile (derives 100% from semantic), matching the existing resolve-or-fill (`rc`/`rd`) pattern used everywhere else.
3. **Validation**: a new `TST13xx`-range diagnostic for a `component.*` token that references a nonexistent semantic slot (extends the T10 DTCG-validation work).
4. **New exporter**: `@transtyle/exporter-primeng`, emitting a `definePreset`-shaped TypeScript module — structured-object output, closer in spirit to Radix than to Bootstrap's Sass variables.
5. **Docs**: `docs/specs/exporters/primeng.md`, a website page, ROADMAP/roadmap.md entries — same five-surface sync rule as every prior exporter.
6. **Demo project**: PrimeNG is Angular-only, new for this repo (every existing demo is Vite/React or framework-agnostic) — `docs/specs/demo-app.md` would need an Angular profile.

## 6. Recommended sequencing

1. **Do the real cross-ecosystem study before committing new semantic vocabulary** — a proposal-0001-style pass, scoped to component-tier architecture specifically, across systems that proposal 0001 already enumerated but didn't study at this depth: Material 3 (`comp` tier), Fluent 2 (per-control tier), Ant Design v5 (component tier), Chakra v3/Panda (recipes), plus the Spectrum spot-check already done here (§2.8). Output: which grouping concepts are genuinely convergent (candidates: something `field`-shaped keeps appearing across ecosystems with form controls — worth confirming), which are PrimeNG- or Spectrum-specific, and the actual shared vocabulary the catalog should adopt — not the four groups §4 guessed from one source.
2. **The color-grid finding (§2.4, §2.6) is on much firmer ground and doesn't block on step 1** — `variant × severity × state × part ≅ prominence × role × state × cell` rests on the same 14-ecosystem role-grid study already accepted in proposal 0001, not on PrimeNG alone. The generic severity-grid mapper (§5.2) and the ramp projector (§2.6, reusing `exporter-radix`'s technique) can be built and proven against Button now, independent of the archetype-group question.
3. **Extend the mapper across the ~25–35 severity-colored components via shape descriptors** once step 2 is proven on Button — the step that stress-tests the *generic* mapper against real shape variance and produces the "hand-written component-theming prototype" evidence ADR-0003's precondition list asks for.
4. **Only then finalize the archetype-group semantic additions from step 1's findings** and handle the structural residue (DataTable, Galleria, Tree, …), leaving genuinely bespoke parts `dropped`/`unsupported` with an honest coverage note.
5. **Write the actual RFC/plan doc** (`docs/plan/component-tier.md`, mirroring `catalog-revision.md`'s task-by-task rigor) from what steps 1–4 actually found, not from this analysis alone.

## Open questions for you

- Should I run the proper multi-ecosystem study (step 1) now — likely a dedicated pass before more PrimeNG-specific work, given it gates what new vocabulary is even correct — or proceed with the color-grid/mapper work (step 2, which doesn't depend on it) in parallel?
- Confirm the exporter strategy in §5: override a base preset (Aura by default, configurable) + one generic severity mapper + per-component shape descriptors, rather than hand-authoring per-component value tables.
- Should the PrimeNG exporter's Angular demo project reuse the existing "Nimbus Console" fake-page content (translated to Angular), or is a fresh demo page acceptable given it's the first non-React/Vite demo in the repo?
