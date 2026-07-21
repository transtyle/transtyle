# Proposal 0002 — Component-tier tokens, using PrimeNG as the forcing function

**Status: DRAFT — analysis only, no implementation yet.** This document answers "what would Transtyle need in order to support PrimeNG," and doubles as the v2 component-tier RFC that [ADR-0003](../adr/0003-tokens-first.md) and [component-layer.md](../specs/component-layer.md) said would happen "from evidence" once a real exporter's component-theming needs existed. PrimeNG is that evidence.

## 1. Why PrimeNG, and why now

Every reference exporter shipped so far (shadcn, Bootstrap, daisyUI, ECharts, Storybook, css-variables, Radix) binds **at the semantic tier only** — the "exporters bind to the semantic tier" rule in [ir.md](../architecture/ir.md#the-three-tier-token-model). That rule has held because none of those targets *require* per-component tokens to look correct: Bootstrap's `$btn-*` variables are a handful of conventions layered informally on top of `$primary` etc.; shadcn's components read CSS variables that are themselves semantic-tier.

PrimeNG is different in kind, not just degree: it ships an explicit, first-party, three-tier **design token system** (`primitive` → `semantic` → `components`), documented as such, with ~90 components each carrying their own token namespace. It is the first target where "bind at the semantic tier" is not just insufficient but actively wrong — PrimeNG's own docs tell integrators to use component tokens "when customizing a specific component" as a matter of design philosophy. Supporting it properly means actually building the reserved-but-inert `component.*` tier ([ir.md line 25](../architecture/ir.md#the-three-tier-token-model): "RESERVED for v2 — parsed, carried, unused") into something exporters can read.

This is exactly the situation [ADR-0003](../adr/0003-tokens-first.md) anticipated and gated: v2 component work is deferred until it can be "designed from evidence: real exporters' hand-written component-theming prototypes, not a priori abstraction." **This proposal treats a PrimeNG exporter as that prototype**, not as jumping the gate.

## 2. PrimeNG's actual architecture (verified against source, not just docs prose)

Fetched live from `github.com/primefaces/primeuix` (the theme package backing PrimeNG ≥19; PrimeNG itself now just re-exports it) — `packages/themes/src/presets/aura/base/index.ts` and `.../aura/button/index.ts`, 2026-07-21.

### 2.1 Primitive tier
Raw palette: 17 hue families (`emerald`, `green`, `lime`, `red`, `orange`, `amber`, `yellow`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `slate`, `gray`, `zinc`, `neutral`, `stone`) × 11 steps (`50`–`950`) — no context, exactly Transtyle's `option.*` tier. Also a primitive **size** scale: `borderRadius.{none,xs,sm,md,lg,xl}` — six named radius steps with no semantic meaning yet.

### 2.2 Semantic tier — global
Small scalar tokens (`transitionDuration`, `disabledOpacity`, `iconSize`, `anchorGutter`), a `primary.{50..950}` ramp (an 11-step alias of one primitive family — brand-adaptive), a `focusRing` **composite** (`width`, `style`, `color`, `offset`, `shadow` — five sub-fields, not a single color), and a `surface`-equivalent gray ramp.

### 2.3 Semantic tier — shared by component *class* (the part with no Transtyle equivalent yet)
This is the finding that matters most. PrimeNG's `semantic` object also carries groups consumed by *many* concrete components at once, not one:

- **`formField.*`** — `paddingX`/`paddingY` (+ `sm`/`lg` variants), `borderRadius`, its own `focusRing` override, `transitionDuration`. Read by Button, InputText, Select, Checkbox, DatePicker, and every other form-adjacent component.
- **`list.*`** — `padding`, `gap`, `header.padding`, `option.padding`/`option.borderRadius`, `optionGroup.*`. Read by Listbox, Select's panel, Menu, AutoComplete's dropdown, TieredMenu, etc.
- (Not fully fetched, but confirmed to exist by every component that consumes them): an overlay-surface group (dialog/popover/select-panel background+border+shadow) and a content-container group (Card/Panel background+border).

PrimeNG doesn't name this a fourth tier — it's still nominally "semantic" — but functionally it is a **component-archetype layer**: a named bundle of tokens shared by every component that plays the same structural role ("I am a form control," "I am a floating overlay," "I am an option list"), sitting between the single flat semantic catalog and 90 independent component namespaces. Without naming and building this layer, a PrimeNG exporter would have to duplicate paddingX/paddingY/borderRadius/focusRing logic ~15 times instead of once.

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

## 3. Gap analysis — what Transtyle's language actually needs

Ranked by how novel each requirement is, cheapest first:

| # | Need | Verdict |
|---|---|---|
| 1 | Map PrimeNG's `variant`/`severity`/`state`/`part` grid to `semantic.color.<role>.<cell>` | **No new tokens.** A mapping table in a new `@transtyle/exporter-primeng`, same shape as every existing exporter's `MAPPING`/`COLOR_MAPPING` table. |
| 2 | `help` severity | **Solved already, by T7.** PrimeNG's 9th severity isn't one of `COLOR_ROLES`; a design system that wants it authors a custom `semantic.color.help` role with `$extensions.transtyle.role: {"archetype": "status"}` (docs/architecture/ir.md §archetypes) and it joins the grid exactly like a built-in role — no engine change needed, this was literally built for this kind of case. |
| 3 | `contrast` severity | **No new tokens**, a mapping decision: PrimeNG's `contrast` is the near-black/near-white extreme (`surface.950` light / `surface.0` dark) — maps cleanly onto `neutral.text-strong` (light) / the dark-mode neutral extreme, both of which already exist. |
| 4 | Component-archetype groups (`formField`, `list`, overlay-surface, content-container) | **New, but small and derivation-only.** Propose adding a handful of new semantic groups that alias *existing* catalog values — see §4. This is genuinely new vocabulary, but it's plumbing (aliases + one new derivation rule each), not new primitives. |
| 5 | Size variants (`sm`/`lg`) per component | **Reuse an existing pattern, don't invent one.** The catalog already has exactly this shape for typography: `semantic.type.role.<role>.<size>` (`docs/architecture/ir.md`). Component tokens should follow the identical `component.<name>.<size>.<part>` convention rather than a new mechanism. |
| 6 | `focusRing` as a 5-field composite (width/style/color/offset/shadow) vs. Transtyle's flat `ring` color | **Defer — don't add a DTCG composite yet.** Transtyle already has precedent for composite types when a real need forces it (`shadow` for `elevation.N.shadow`). But a single exporter needing 4 more scalar fields around one existing color doesn't clear that bar alone — bind `ring` for the color, let the PrimeNG exporter hardcode `width`/`style`/`offset` as its own reasonable constants (same trade-off Bootstrap's exporter already makes for `$focus-ring-color` at "conventional alpha .25"). Revisit if a *second* component-heavy exporter (MUI, Chakra) independently needs the same 5 fields — that's the actual bar this project already uses elsewhere ("two consecutive... before the catalog is declared frozen," ADR-0010). |
| 7 | Primitive radius scale (`none`/`xs`/`sm`/`md`/`lg`/`xl`) | **No new tokens.** Maps onto the existing `radius.{control,field,container}` family plus the catalog-default `radius.md`; the exporter just needs a translation table (`none→0`, `xs→border-width-ish`, …), same as Bootstrap's `xxl = xl × 2` convention already does for a mismatched scale. |
| 8 | The `component.*` tier itself | **Build it.** It's specced (`component-layer.md`) and reserved in the schema, but nothing resolves, validates, or derives it today. This is the real engineering lift — see §5. |

## 4. Proposed new semantic vocabulary (the actually-new part)

Small, all derivation-only (an empty override compiles today and forever, per `component-layer.md`'s existing principle):

```jsonc
"semantic": {
  "field": {                          // NEW — shared by every form-adjacent component
    "padding-x": { "$value": "{space.4}" },        // aliases existing scale defaults
    "padding-y": { "$value": "{space.2}" },
    "radius":    { "$value": "{radius.field}" },    // already exists
    "sm": { "padding-x": {...}, "padding-y": {...} },
    "lg": { "padding-x": {...}, "padding-y": {...} }
  },
  "list": {                           // NEW — shared by Listbox/Select-panel/Menu/AutoComplete
    "padding": { "$value": "{space.1}" },
    "gap":     { "$value": "{space.0}" },
    "option": {
      "padding": { "$value": "{space.2} {space.3}" },
      "radius":  { "$value": "{radius.control}" }
      // hover/selected backgrounds are NOT new — they alias primary.tint / primary.tint-hover, already in the grid
    }
  }
}
```

No new primitives, no new derivation rules beyond simple aliasing (`raise()`-style helpers already exist for anything fancier). These two groups alone cover the shared layer every PrimeNG form/overlay/list-shaped component needs — Card/Panel's content-container needs likely reduce to existing `elevation.*` + `border`, needing no new group at all (confirm once fetched in full during implementation).

## 5. What building `component.*` actually requires (engineering, not vocabulary)

This is the real work, and it's squarely v2/Phase 4 per the existing roadmap gate — listed here for completeness, not as a commitment to build it now:

1. **`packages/ir`**: a `COMPONENT_CATALOG` constant (the fixed component list `component-layer.md` sketches — Button, Input, Select, …) with, per component, its dimensional tokens, its variant/state model, and which semantic-tier group(s) it defaults from.
2. **`packages/core/src/normalize.js`/`derive.js`**: actually resolve `component.*` tokens instead of "parsed, carried, unused" — an empty `component` tier must still compile (derives 100% from semantic), matching the existing resolve-or-fill (`rc`/`rd`) pattern used everywhere else.
3. **Validation**: a new `TST13xx`-range diagnostic for a `component.*` token that references a nonexistent semantic slot (extends the T10 DTCG-validation work).
4. **New exporter**: `@transtyle/exporter-primeng`. Given PrimeNG presets are literally TypeScript objects (`ButtonDesignTokens` etc.), the exporter's natural output is a `definePreset`-shaped module — closer in spirit to the Radix exporter (structured object output) than to Bootstrap (Sass variables).
5. **Docs**: `docs/specs/exporters/primeng.md`, a website page, ROADMAP/roadmap.md entries — same five-surface sync rule as every prior exporter.
6. **Demo project**: PrimeNG is Angular-only, which is new for this repo (every existing demo is Vite/React or framework-agnostic) — the demo-app spec (`docs/specs/demo-app.md`) would need an Angular profile.

## 6. Recommended sequencing

1. **Don't open v2 wholesale.** Build only what a real PrimeNG exporter needs, in the order of §3's table (cheapest/most-validated first). This is smaller than the full `component-layer.md` sketch (15 components) — start with Button alone, since it's the one already verified against source in this document, and it alone exercises the full variant×severity×state×part grid.
2. **Ship the two new semantic groups (`field`, `list`) as an ordinary semantic-catalog addition** — no gate, this is just new derivation-only vocabulary, same category of change as T7/T8.
3. **Prototype `component.button.*` end to end** — real resolution, real derivation fallback, real PrimeNG exporter output, on Acme. This *is* the "hand-written component-theming prototype" ADR-0003's precondition list asks for. Its existence is what lets the v2 gate discussion happen with evidence instead of a priori design.
4. **Write the actual RFC/plan doc** (a `docs/plan/component-tier.md`, mirroring `catalog-revision.md`'s task-by-task rigor) only after step 3 produces real findings — some of what's guessed above (the content-container group, the exact radius-scale translation) will turn out wrong or incomplete once real component tokens are being resolved, and that plan should be written from what actually happened, not from this analysis alone.

## Open questions for you

- Scope: Button-only prototype first (recommended), or commit to the full 15-component `component-layer.md` list up front?
- Should the PrimeNG exporter's Angular demo project reuse the existing "Nimbus Console" fake-page content (translated to Angular), or is a fresh demo page acceptable given it's the first non-React/Vite demo in the repo?
- Do you want me to proceed to implementation (starting with the two new semantic groups + the Button prototype), or write the formal plan doc first and pause for your sign-off before touching code?
