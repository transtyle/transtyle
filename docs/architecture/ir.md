# Intermediate representation (IR)

> **Status: IR spec v0 (draft, pre-release) — catalog revised in place, landed 2026-07-20.** The role-grid catalog below (per [proposal 0001](../proposals/0001-universal-token-ir.md) and [ADR-0010](../adr/0010-pre-release-breaking-changes.md)) replaced the previous catalog as a clean break, **not a version bump**: Transtyle is unreleased, so old slot names were removed rather than aliased, and the spec stays `v0` throughout. [docs/plan/catalog-revision.md](../plan/catalog-revision.md) tasks T1–T10 are done — the engine (`derive.js`), all eight exporters, role archetypes (open custom color roles), multi-dimension modes, DTCG validation UX, and all four examples now implement this document as written. T11 (the real-DS run) is engineering-complete on GOV.UK and Carbon, waiting only on the maintainer practitioner review; the [ROADMAP](../../ROADMAP.md) tracks that. The freeze discipline (additive minors only; rule semantics move only via new rule-pack versions) re-arms at first npm publication, at which point version numbers start moving.

The IR is the contract between everything: importers produce it, derivation completes it, exporters consume it. It is the project's most stability-critical artifact — more stable than the CLI, more stable than any exporter. Spec-versioned independently (see [versioning.md](versioning.md)).

## Foundation: DTCG superset ([ADR-0002](../adr/0002-dtcg-superset-ir.md))

Source token files are **valid DTCG documents**. All additions live under `$extensions` with the `transtyle.` namespace (see [naming.md](../naming.md)) or in the separate config file. Two consequences we commit to:

1. Any DTCG tool can read our token files (ignoring extensions) and produce something sensible.
2. When the DTCG spec standardizes something we extended (modes are the likely first case), we deprecate our extension in favor of the spec form, with a codemod (`transtyle migrate`).

Supported `$type`s: the DTCG set — `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, plus composites `typography`, `shadow`, `border`, `gradient`, `transition`, `strokeStyle`. Extension types are not allowed in v1; anything a target needs beyond these is the exporter's job to construct.

## The three-tier token model

The IR distinguishes tiers because exporters bind at different tiers and derivation flows between them:

```
option tokens        color.blue.500, size.4, font.sans        raw palette; no meaning
   ↓ (alias / derive)
semantic tokens      color.primary, color.surface, radius.interactive   meaning; framework-agnostic
   ↓ (alias / derive)                                                   ← exporters bind HERE
component tokens     control.padding-x, button.radius         optional refinement; layered, defaults from semantic
```

**The component tier** ([proposal 0003](../proposals/0003-component-catalog-generalization.md)) is optional refinement, never a requirement: every slot has a `defaultFrom`, so an empty `component` tier compiles forever and authoring one is purely additive. Today's catalog is deliberately small — `control.{radius,padding-x,padding-y}` (the shared interactive-control geometry) and `button.*`, which **defaults from `control.*`** rather than from the semantic tier directly. That layering is not our invention: Bootstrap chains `$btn-padding-*` from the shared `$input-btn-padding-*` root, and PrimeNG's Button reads the same `formField` object its inputs do. Authoring `control.*` moves buttons and form fields together in both targets; authoring `button.*` moves only buttons. Slots enter this tier under the same rule as the semantic catalog — two independent exporters needing the identical meaning, architecturally and not just nominally.

Tier is structural (top-level group name: `option.*`, `semantic.*`, `component.*`), not inferred — inference from naming conventions is fragile and unlocalizable. The direction of the layering is enforced: a `semantic.*` token that aliases a `component.*` token is an error (`TST1113`), and no official exporter may bind a coverage row to an `option.*` slot (`check:plugins`, `check:minimal-ds`).

**Exporters bind to the semantic tier.** This is the load-bearing rule of the whole system: option tokens are private vocabulary that users can restructure freely; the semantic tier is the stable surface. An exporter referencing `color.blue.500` directly would break on every palette rename.

**The semantic tier is a meta-language, not a mirror of any one target.** A target's own internal organization — PrimeNG's shared `formField`/`list` token groups, Adobe Spectrum's large flat vocabulary of precisely-named per-context tokens, Bootstrap's `$btn-*` conventions — is that target's business, reconstructed by its exporter from the meta-language, never copied into the catalog as-is. Two consequences: (1) an exporter may read the _same_ semantic token into several differently-shaped or differently-named places in its target, translating by _meaning_, never by name (`website/src/docs/language.md#false-friends`); (2) new shared derivation logic a target needs starts **exporter-private** and is promoted into shared catalog vocabulary only once a second, independent exporter converges on the identical thing — see `CONTRIBUTING.md`'s principles and the F10 precedent (a private Bootstrap convention, later promoted into an engine-owned grid cell once the comparative study showed it wasn't Bootstrap-specific).

## The semantic contract

A fixed, versioned catalog of semantic slots that exporters may rely on existing after DERIVE. **The catalog — the role grid**, derived from a comparative study of ~14 design-system ecosystems ([proposal 0001](../proposals/0001-universal-token-ir.md)) to be the smallest set of concepts capable of representing all of them:

<!-- measured: catalog.slots = 264 -->
<!-- measured: catalog.semantic = 257 -->
<!-- measured: catalog.component = 7 -->

**Machine-readable form:** `catalog()` in `@transtyle/core`, printed by `transtyle catalog --json` ([cli.md](../specs/cli.md#catalog--the-contract-as-data)) — 264 slots today, 257 semantic and 7 component, each with its DTCG type, the rule that fills it when unauthored, that rule's inputs and the anchor it requires. It is read off the engine by a probe compile, so it is the implemented catalog; where this page and it disagree, this page is the one to fix.

### Color: the role grid

Every color role is a **two-axis grid** — prominence × interaction state — not a flat set of named values. This is the central finding of proposal 0001: every mature ecosystem (Radix's 12 steps, Ant's map tokens, Bootstrap's subtle triad, Chakra's colorPalette, Material 3's container/on pairs) is sampling the same grid; naming it directly instead of re-deriving a private sample per exporter is what makes exporters composable and custom roles derivable.

**Cell naming rule:** within a role, the _rest_ state is the bare prominence name; other states suffix with `-<state>`; on-colors prefix `on-`. Grid paths are `semantic.color.<role>.<cell>`:

```
prominence →   solid            tint            outline          text
state ↓
rest           solid            tint            outline          text
hover          solid-hover      tint-hover      outline-hover    text-hover
active         solid-active     tint-active     —                text-active
selected       solid-selected   tint-selected   —                —
on-colors      on-solid         on-tint         —                —
strong         —                —               —                text-strong
```

- **Roles:** `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info`, `neutral` — unchanged from before, each now carrying the full grid above.
- The **authored anchor** of a role is `<role>.solid` (its principal value — what the previous catalog called `.base`). `derivation.require` continues to point at roles; requiring a role means its `solid` cell must be authored or aliased.
- **Custom roles** may declare an _archetype_ (`brand`, `status`, `neutral`) via `$extensions.transtyle.role: { "archetype": "..." }` on the role's group (alongside its `.solid` child, not on the leaf itself) and get the full grid derived like a built-in role — the same generic derivation `derive.js` uses for `secondary`/`accent`/etc., just requiring the role's own `.solid` authored instead of computing it from `primary` (**implemented**, plan task T7; see Cathode's `crt-amber`, `docs/specs/exporters/css-variables.md` and `docs/specs/exporters/daisyui.md` for how open-role-set exporters emit it).

### Elevation ladder (replaces the old surface slots)

`semantic.elevation.<n>.surface` for `n = 0..5`; `semantic.elevation.<n>.shadow` for `n = 1..4`. The old names `background`, `surface`, `surface-raised`, `overlay` are **gone** — they were single steps of this ladder wearing separate names; all consumers now say `elevation.0.surface`, `elevation.1.surface`, etc. `scrim` remains its own slot, `semantic.color.scrim` — a dimming veil, not an elevation level (exercise finding [F2](../exercises/phase0-shadcn.md)).

### Content hierarchy

`semantic.color.text.{strong, base, muted, subtle, disabled, inverse}` and `semantic.color.link.{base, hover, visited}`. (`text.base` is the _default rung_ of this ladder — not a leftover of the old `.base` state suffix, which no longer exists outside the grid.) `ring` is a single-value slot (`semantic.color.ring`).

**Borders** are a ladder too, `semantic.color.border.{subtle, base, strong, field}` ([proposal 0005](../proposals/0005-border-ladder-inverse-pair.md)): content borders by strength (separators and cards, the default border, a boundary at 3:1), plus `field`, the neutral border of a form field at rest. They are the _content_ borders; the role grid's `<role>.outline` cells stay the _role-tinted_ ones (outlined buttons, alerts), the same split as `text.*` against `<role>.text`. Until proposal 0005 the catalog had one leaf, `semantic.color.border`; it was renamed in place to `border.base` under [ADR-0010](../adr/0010-pre-release-breaking-changes.md), and a token left at the old path is an error (`TST1122`), not a silent custom token.

**The inverse pair**, `semantic.color.inverse.{surface, text}` (proposal 0005), is the bubble tooltips and contrast toasts are painted with: dark on a light page, light on a dark one. It is not `text.inverse`, which is the other mode's body text (what Storybook's `textInverseColor` wants): the targets put `elevation.0.surface` on an inverse surface, not the other mode's text.

### Data visualization

`semantic.palette.categorical.1–8` — unchanged from before, including the **frozen 1–5 cross-target contract** (see [Stability policy](#stability-policy)).

### Scales

- **Shape:** `radius.{none,sm,md,lg,xl,full}` + family aliases `radius.{control,field,container}` (each defaults to `{radius.md}`); `border-width.{thin,medium,thick}`.
- **Spacing:** `space.{0,1,2,3,4,5,6,8,10,12,16,20,24}`.
- **Sizing:** `size.control.{sm,md,lg}` — the one component-adjacent primitive every consuming library needs pre-component-tier.
- **Layout:** `breakpoint.{xs,sm,md,lg,xl,2xl}`; `z.{hide,base,dropdown,sticky,banner,overlay,modal,popover,toast,tooltip}` — key _order_ is the contract, values are catalog defaults unless authored.
- **Typography primitives:** `font.{sans,serif,mono,display}` (`font.serif` is a reserved name: nothing derives, defaults or reads it yet, so `catalog()` doesn't list it; `font.display`, when authored, replaces `font.sans` in `type.role.display.*`); `type.size.{xs,sm,md,lg,xl,2xl,3xl,4xl}`; `type.weight.{regular,medium,semibold,bold}`; `type.leading.{tight,normal,loose}`; `type.tracking.{tight,normal,wide}`.
- **Typography roles** (DTCG `typography` composites, projecting the primitives): `type.role.{display,heading,title,body,label,code}.{sm,md,lg}`.
- **Motion:** `duration.{instant,fast,normal,slow,slower}`; `easing.{standard,enter,exit,emphasized,spring}` (`enter` ≡ decelerate, `exit` ≡ accelerate; the old `bounce` renamed `spring`).
- **Opacity:** `opacity.disabled` — a single slot, not a ladder, promoted by [proposal 0003](../proposals/0003-component-catalog-generalization.md) once both reference component-heavy targets independently needed the identical meaning (PrimeNG's `disabledOpacity` constant, Bootstrap's `*-disabled-opacity` variables). Other opacity knobs (veil strengths, shimmer ranges, glyph alphas) stay exporter-private until a second target needs the same one.

### Reserved mode dimensions

Names only — every dimension stays optional and a design system declares only what it uses: `color-scheme`, `density` (`compact|comfortable|spacious`), `contrast` (`standard|more`), `motion` (`full|reduced`), `platform` (`desktop|touch`).

Users may add custom semantic tokens beyond the catalog (they flow to exporters that look them up), but only catalog slots are _guaranteed_ and derivable. The catalog grows via minor IR spec versions; slots are never removed within a major (once the freeze re-arms — see the status banner).

**Why a fixed catalog (a real trade-off):** it constrains exotic design systems, but it is what makes exporters composable — every exporter targets the same known surface instead of each inventing its own required-token list. The catalog is the instruction set of this compiler. The full grid is what makes that instruction set actually universal rather than a sample biased toward the first exporter written — see proposal 0001 §2.2 for the finding that motivated it.

## Modes

DTCG has no mode concept yet; this is our largest extension.

```jsonc
// transtyle.config.json (modes are config, not token-file content)
"modes": {
  "color-scheme": { "values": ["light", "dark"], "default": "light" },
  "density":      { "values": ["comfortable", "compact"], "default": "comfortable" }
}
```

Per-mode values have two equivalent authoring forms — inline `$extensions` (below), or **mode-scoped layer files** declared in the manifest so token sources stay pure DTCG ([ADR-0009](../adr/0009-token-layering.md), [configuration.md](../specs/configuration.md#token-layering)). Both produce the identical internal representation. Inline form:

```jsonc
"surface": {
  "$type": "color",
  "$value": "{option.color.white}",            // default-mode value — plain DTCG readers see this
  "$extensions": { "transtyle.modes": { "color-scheme": { "dark": "{option.color.gray.900}" } } }
}
```

Rules: the mode matrix is the cross-product of dimensions, resolved per-dimension independently (a token may vary by scheme and density; combinations are compositional, with an explicit override syntax for the rare pathological pair). Unspecified mode values fall back to the default-mode value — or to a derivation rule (e.g. auto-dark, see [derivation.md](derivation.md)) if enabled. Exporters receive the expanded matrix and decide the native encoding (CSS `.dark` class for shadcn, `data-bs-theme` for Bootstrap, separate theme JSON per mode for ECharts). Exporters declare which mode dimensions they can express; inexpressible dimensions surface in the coverage report.

**Mode polarity rule:** `default` declares the design system's _native_ mode (which mode plain-DTCG readers see as `$value`) — it does not reorder anything for targets. Exporters bind mode **names** (`light`, `dark`), never the default flag: a dark-native design system still compiles to shadcn's light-first `:root`/`.dark` structure. Found the hard way by the [Cathode example](../../examples/cathode/), which is dark-native.

## Values and canonicalization

- **Color:** accepted syntaxes are `oklch()`, `#hex` (3/4/6/8 digits, alpha included), `rgb()`/`rgba()`, `hsl()`/`hsla()` (both the modern space-separated and legacy comma forms, with `deg`/`rad`/`grad`/`turn` hues), `hwb()`, `lab()`, `lch()`, `oklab()`, `color()` with a CSS predefined space, the CSS named colors, and `transparent` — i.e. what real stylesheets actually contain, so an existing product's values can be adopted verbatim (audit B7, forced by [P4](../findings/hostile-adoption.md)) — and the DTCG color object `{ colorSpace, components, alpha?, hex? }` in the fourteen DTCG color spaces (issue #25), what design tools export. Every space converts to unbounded linear sRGB, then through the one OKLab matrix, so a wide-gamut color keeps its chroma, and an `srgb` object takes the exact path of `#hex` (bit-identical). For `srgb`, a `hex` within 0.01 per channel of the components wins (a two-decimal export ships the designer's color); further off, the components win with `TST1123`. `none` components convert as 0; a malformed object is `TST1106`. Canonical internal form is OKLCH (perceptually uniform — required for honest derivation of hover states, scales, and contrast math). Original authored form is kept in provenance; exporters choose output syntax per target version (hex for ECharts, HSL channels for shadcn pre-v4 era, etc.).
- **Dimensions:** explicit units required (`16px`, `1rem`), and carried through **as authored** — there is no unit normalization, so `0.5rem` reaches the exporter as `0.5rem`. The DTCG object form (`{ "value": 0.5, "unit": "rem" }`, units `px`/`rem`) is accepted and canonicalized in NORMALIZE to that same CSS string, so it compiles byte-identical to the string form; a bare number other than `0`, a non-number `value`, or a missing or unknown unit is `TST1106`. The canonical value is the string rather than a structured `{ value, unit }` because every consumer (the radius scale in DERIVE, the unit-converting exporters, third-party exporters tested on the plugin-kit fixture) already reads the string ([#24](https://github.com/transtyle/transtyle/issues/24)). An exporter whose target demands another unit converts through `ctx.units` (`toPx`, `toRem`, `remBase`) and reports the row `approximated` with the base named. The base is the config's `units.remBase` (a positive px length, default `"16px"`; [configuration](../specs/configuration.md)), so a system with a 10px or 14px root gets the right pixels in every non-CSS target; ECharts and Storybook use it today, and Storybook's `options.remBase` still overrides it for that one target. Unit conversion is flagged `approximated` in coverage when it changes meaning.
- **Durations, easings, font weights:** the same rule — CSS form carried as authored, DTCG structured form canonicalized to it. `duration` `{ "value": 150, "unit": "ms" }` (units `ms`/`s`) becomes `150ms`; `cubicBezier` `[x1, y1, x2, y2]` (x1 and x2 in [0, 1]) becomes `cubic-bezier(x1, y1, x2, y2)`; a `fontWeight` DTCG keyword that CSS doesn't know (`semi-bold`, `extra-light`, `ultra-black`, …) becomes its number, while numbers 1–1000 and the keywords CSS shares (`normal`, `bold`) stay as authored. Numbers are written without exponent notation. A malformed structured value is `TST1106`, with a hint naming the accepted forms.
- **Font families:** the other way round. The canonical form is the DTCG array of names, most preferred first, because every exporter reads the list and quotes each name for its own target; a `fontFamily` authored as one string (`"Inter, system-ui, sans-serif"`, which DTCG also allows) is split into it in NORMALIZE, so the two forms compile byte-identical ([#183](https://github.com/transtyle/transtyle/issues/183): four exporters crashed on the string with `TST3001`). The split is on the commas outside quotes and parentheses; each name is trimmed, a quoted name loses its quotes (`'Helvetica Neue'` → `Helvetica Neue`, the way the array form writes it), a CSS function (`var(--font)`) is kept whole, and an empty name or a non-string entry is `TST1106`. `fontNames()` and `fontStack()` in `@transtyle/ir` are the split and the CSS rendering, for exporters (an IR built by hand may still carry a string).
- **Composites:** `shadow`, `typography`, `border` and `transition` values are objects whose members carry their own DTCG types, and each member is canonicalized like a token of that type: a `shadow.color` becomes OKLCH; a dimension, duration, cubicBezier or fontWeight member (`typography.fontSize`/`letterSpacing`/`fontWeight`, `shadow` offsets/blur/spread, `border.width`, `transition.duration`/`delay`/`timingFunction`) is canonicalized to its CSS string as above, its structured form included; a `typography.fontFamily` member becomes its array of names like a top-level family; the rest (`style`, `inset`) are carried as authored. A `shadow` may also be an array of layers. Members may alias, with the same per-mode and deferred resolution as a whole token; the composite itself stays `authored`, and its member aliases are recorded in provenance for `explain`. `gradient` is not yet parsed member by member.
- **References:** DTCG `{path.to.token}` aliases, resolved in NORMALIZE; cycles are errors with the full chain in the diagnostic. An alias whose target is a slot **DERIVE materializes** (`{semantic.radius.full}`, a role-grid cell, an elevation rung) is legal and resolves in a deferred pass right after DERIVE — the authoring style this document's [component tier](#the-three-tier-token-model) uses. The deferral changes only _when_ a dangling alias is diagnosed, never _whether_: a target that never materializes is still `TST1105`, and a deferred alias always beats the catalog default for its slot (authored wins is unconditional). Such an alias also feeds DERIVE: a role whose `.solid` is bound to another role's `.solid` or grid cell gets its own grid, and a component slot whose semantic source is bound to a derived scale step is materialized, because DERIVE reads an alias as soon as its target is filled. The exception is a slot derived _after_ the one that reads it (a role bound to `ring`, `link.*` or the categorical palette; `text.base` bound to a role cell): the alias still resolves, what depends on it is not derived, and `TST1205` names it.

## Provenance (attached to every resolved value)

`authored` | `aliased(target[, rule])` | `derived(rule, inputs[])` | `defaulted`, each also carrying the mode it resolved in. Not part of user files — attached during compilation, consumed by `explain`, coverage, and `diff`. `rule` on `aliased` is set only for an alias a config `bindings` rule produced (`bindings[<n>]: <slot pattern>`); a hand-written alias has none. **Specced:** the `(file, line)` on `authored`. LOAD knows which file a tree came from and nothing carries it further, so today a diagnostic or an `explain` trace names the token path rather than its location.

## Entry metadata: description and deprecation

Next to its value and provenance, an entry carries the token's DTCG metadata when the token has it: `description` (its own `$description`) and `deprecated` (`true`, or the `$deprecated` reason string, inherited from the nearest group that sets it; `$deprecated: false` opts out). Both are per token and identical in every mode; derived and defaulted slots have neither, and an aliased slot keeps its own rather than its target's. Exporters may write them as comments (`entryNotes()` in `@transtyle/ir`); core adds them to `report.json` items, lists deprecated tokens feeding a target in its `usage.md`, and reports a catalog slot that reaches a deprecated token (`TST1122`). See [validation-and-coverage.md](../specs/validation-and-coverage.md#token-metadata-description-and-deprecated).

## Stability policy

The IR schema carries `"$schema": ".../ir/v0"`. Within a major spec version: new optional slots and types may appear (minor); nothing is removed or re-typed. Exporters declare the IR spec they support in their manifest — **specced:** core reading it and refusing mismatches with a clear diagnostic rather than corrupting output.

**Cross-target value contracts.** Some _derived values_ are shared by multiple exporters and therefore constitute an ABI stronger than rule-pack pinning: they may not change even across rule-pack versions without a major. The first such contract: **`palette.categorical.1–5` are frozen** — shadcn's `--chart-1…5` and ECharts' `color[]` consume the same entries, and "charts match across every target" is a product promise, not an implementation detail. Extending the palette appends entries only (5 → 8 was done this way, verified by byte-comparing shadcn output before/after). Any future shared derived value must be declared in this section when the second consumer appears.
