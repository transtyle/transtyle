# Intermediate representation (IR)

> **Status: IR spec v0 (draft, pre-release) — catalog revised in place, landed 2026-07-20.** The role-grid catalog below (per [proposal 0001](../proposals/0001-universal-token-ir.md) and [ADR-0010](../adr/0010-pre-release-breaking-changes.md)) replaced the previous catalog as a clean break, **not a version bump**: Transtyle is unreleased, so old slot names were removed rather than aliased, and the spec stays `v0` throughout. [docs/plan/catalog-revision.md](../plan/catalog-revision.md) tasks T1–T4, T6–T9 are done — the engine (`derive.js`), all seven exporters, role archetypes (open custom color roles), multi-dimension modes, and both examples now implement this document as written. Remaining plan tasks (DTCG validation UX, the real-DS run) are tracked in the [ROADMAP](../../ROADMAP.md). The freeze discipline (additive minors only; rule semantics move only via new rule-pack versions) re-arms at first npm publication, at which point version numbers start moving.

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
component tokens     button.radius, tooltip.bg                RESERVED for v2 — parsed, carried, unused
```

Tier is structural (top-level group name: `option.*`, `semantic.*`, `component.*`), not inferred — inference from naming conventions is fragile and unlocalizable.

**Exporters bind to the semantic tier.** This is the load-bearing rule of the whole system: option tokens are private vocabulary that users can restructure freely; the semantic tier is the stable surface. An exporter referencing `color.blue.500` directly would break on every palette rename.

**The semantic tier is a meta-language, not a mirror of any one target.** A target's own internal organization — PrimeNG's shared `formField`/`list` token groups, Adobe Spectrum's large flat vocabulary of precisely-named per-context tokens, Bootstrap's `$btn-*` conventions — is that target's business, reconstructed by its exporter from the meta-language, never copied into the catalog as-is. Two consequences: (1) an exporter may read the _same_ semantic token into several differently-shaped or differently-named places in its target, translating by _meaning_, never by name (`website/src/docs/language.md#false-friends`); (2) new shared derivation logic a target needs starts **exporter-private** and is promoted into shared catalog vocabulary only once a second, independent exporter converges on the identical thing — see `CONTRIBUTING.md`'s principles and the F10 precedent (a private Bootstrap convention, later promoted into an engine-owned grid cell once the comparative study showed it wasn't Bootstrap-specific).

## The semantic contract

A fixed, versioned catalog of semantic slots that exporters may rely on existing after DERIVE. **The catalog — the role grid**, derived from a comparative study of ~14 design-system ecosystems ([proposal 0001](../proposals/0001-universal-token-ir.md)) to be the smallest set of concepts capable of representing all of them:

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

`semantic.color.text.{strong, base, muted, subtle, disabled, inverse}` and `semantic.color.link.{base, hover, visited}`. (`text.base` is the _default rung_ of this ladder — not a leftover of the old `.base` state suffix, which no longer exists outside the grid.) `border` and `ring` are single-value slots (`semantic.color.border`, `semantic.color.ring` — no `.base` suffix).

### Data visualization

`semantic.palette.categorical.1–8` — unchanged from before, including the **frozen 1–5 cross-target contract** (see [Stability policy](#stability-policy)).

### Scales

- **Shape:** `radius.{none,sm,md,lg,xl,full}` + family aliases `radius.{control,field,container}` (each defaults to `{radius.md}`); `border-width.{thin,medium,thick}`.
- **Spacing:** `space.{0,1,2,3,4,5,6,8,10,12,16,20,24}`.
- **Sizing:** `size.control.{sm,md,lg}` — the one component-adjacent primitive every consuming library needs pre-component-tier.
- **Layout:** `breakpoint.{xs,sm,md,lg,xl,2xl}`; `z.{hide,base,dropdown,sticky,banner,overlay,modal,popover,toast,tooltip}` — key _order_ is the contract, values are catalog defaults unless authored.
- **Typography primitives:** `font.{sans,serif,mono,display}`; `type.size.{xs,sm,md,lg,xl,2xl,3xl,4xl}`; `type.weight.{regular,medium,semibold,bold}`; `type.leading.{tight,normal,loose}`; `type.tracking.{tight,normal,wide}`.
- **Typography roles** (DTCG `typography` composites, projecting the primitives): `type.role.{display,heading,title,body,label,code}.{sm,md,lg}`.
- **Motion:** `duration.{instant,fast,normal,slow,slower}`; `easing.{standard,enter,exit,emphasized,spring}` (`enter` ≡ decelerate, `exit` ≡ accelerate; the old `bounce` renamed `spring`).

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

- **Color:** accepted syntaxes are `oklch()`, `#hex` (3/4/6/8 digits, alpha included), `rgb()`/`rgba()`, `hsl()`/`hsla()` (both the modern space-separated and legacy comma forms, with `deg`/`rad`/`grad`/`turn` hues), the CSS named colors, and `transparent` — i.e. what real stylesheets actually contain, so an existing product's values can be adopted verbatim (audit B7, forced by [P4](../findings/hostile-adoption.md)). `lab()`/`lch()`/`hwb()`/`color()` are not yet parsed. Canonical internal form is OKLCH (perceptually uniform — required for honest derivation of hover states, scales, and contrast math). Original authored form is kept in provenance; exporters choose output syntax per target version (hex for ECharts, HSL channels for shadcn pre-v4 era, etc.).
- **Dimensions:** explicit units required (`16px`, `1rem`). A config-level `rem` base (default 16) enables conversion where a target demands a specific unit; unit conversion is flagged `approximated` in coverage when it changes meaning.
- **References:** DTCG `{path.to.token}` aliases, resolved in NORMALIZE; cycles are errors with the full chain in the diagnostic. An alias whose target is a slot **DERIVE materializes** (`{semantic.radius.full}`, a role-grid cell, an elevation rung) is legal and resolves in a deferred pass right after DERIVE — the authoring style this document's [component tier](#the-three-tier-token-model) uses. The deferral changes only _when_ a dangling alias is diagnosed, never _whether_: a target that never materializes is still `TST1105`, and a deferred alias always beats the catalog default for its slot (authored wins is unconditional).

## Provenance (attached to every resolved value)

`authored(file, line)` | `aliased(target)` | `derived(rule, inputs[])` | `defaulted(catalogDefault)`. Not part of user files — attached during compilation, consumed by `explain`, coverage, and `diff`.

## Stability policy

The IR schema carries `"$schema": ".../ir/v0"`. Within a major spec version: new optional slots and types may appear (minor); nothing is removed or re-typed. Exporters declare the IR spec range they support; core refuses mismatches with a clear diagnostic rather than corrupting output.

**Cross-target value contracts.** Some _derived values_ are shared by multiple exporters and therefore constitute an ABI stronger than rule-pack pinning: they may not change even across rule-pack versions without a major. The first such contract: **`palette.categorical.1–5` are frozen** — shadcn's `--chart-1…5` and ECharts' `color[]` consume the same entries, and "charts match across every target" is a product promise, not an implementation detail. Extending the palette appends entries only (5 → 8 was done this way, verified by byte-comparing shadcn output before/after). Any future shared derived value must be declared in this section when the second consumer appears.
