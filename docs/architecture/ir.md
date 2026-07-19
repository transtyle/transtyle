# Intermediate representation (IR)

> **Status: FROZEN at v0 — declared 2026-07-19.** Prerequisite met: the Phase 0 exercise exit criterion (two consecutive clean attempts, rounds 7–8; ledger F1–F21 in [docs/exercises/](../exercises/)). From this declaration on, this document changes only per the [versioning model](versioning.md): additive minors (new optional slots/types), nothing removed or re-typed within v0, and rule-pack semantics move only via a new rule-pack version (`standard@2`), never by editing `standard@1`'s meaning. Editorial fixes that do not change meaning are exempt.

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

## The semantic contract

A fixed, versioned catalog of semantic slots that exporters may rely on existing after DERIVE. Initial catalog (v0, foundations only):

- **Color roles:** `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info`, `neutral`; surfaces `background`, `surface`, `surface-raised`, `overlay` (floating layers: popover/menu/dialog), `scrim` (dimming veil behind modals — distinct from `overlay` per exercise finding [F2](../exercises/phase0-shadcn.md)); content `text`, `text-muted`, and per-role `text-on-<role>.{base, subtle}` (the `subtle` pairing exists because tinted backgrounds need their own readable foreground — finding [F1](../exercises/phase0-shadcn.md)); `border`, `ring`. Each role is a scale: `base`, `hover`, `active`, `subtle`, `contrast` — not a single value, because real targets need states.
- **Typography:** family roles `sans`, `serif`, `mono`, `display`; a modular size scale `size.xs…size.4xl`; weights `regular`, `medium`, `semibold`, `bold`; `leading` and `tracking` scales.
- **Spacing:** a numeric scale (`space.0…space.24`) + semantic aliases `inset.{sm,md,lg}`, `stack.{sm,md,lg}`, `gap.{sm,md,lg}`.
- **Shape:** `radius.{none,sm,md,lg,xl,full}`, `border-width.{thin,medium,thick}`.
- **Elevation:** `shadow.{none,sm,md,lg,xl}` paired with `z.{base,dropdown,sticky,overlay,modal,popover,tooltip,toast}` — shadows and z-index are one concept ("elevation") split into two renderable properties.
- **Motion:** `duration.{instant,fast,normal,slow}`, `easing.{standard,decelerate,accelerate,bounce}`.

Users may add custom semantic tokens (they flow to exporters that look them up), but only catalog slots are *guaranteed* and derivable. The catalog grows via minor IR spec versions; slots are never removed within a major.

**Why a fixed catalog (a real trade-off):** it constrains exotic design systems, but it is what makes exporters composable — every exporter targets the same known surface instead of each inventing its own required-token list. The catalog is the instruction set of this compiler.

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

**Mode polarity rule:** `default` declares the design system's *native* mode (which mode plain-DTCG readers see as `$value`) — it does not reorder anything for targets. Exporters bind mode **names** (`light`, `dark`), never the default flag: a dark-native design system still compiles to shadcn's light-first `:root`/`.dark` structure. Found the hard way by the [Cathode example](../../examples/cathode/), which is dark-native.

## Values and canonicalization

- **Color:** any CSS color syntax accepted; canonical internal form is OKLCH (perceptually uniform — required for honest derivation of hover states, scales, and contrast math). Original authored form is kept in provenance; exporters choose output syntax per target version (hex for ECharts, HSL channels for shadcn pre-v4 era, etc.).
- **Dimensions:** explicit units required (`16px`, `1rem`). A config-level `rem` base (default 16) enables conversion where a target demands a specific unit; unit conversion is flagged `approximated` in coverage when it changes meaning.
- **References:** DTCG `{path.to.token}` aliases, resolved in NORMALIZE; cycles are errors with the full chain in the diagnostic.

## Provenance (attached to every resolved value)

`authored(file, line)` | `aliased(target)` | `derived(rule, inputs[])` | `defaulted(catalogDefault)`. Not part of user files — attached during compilation, consumed by `explain`, coverage, and `diff`.

## Stability policy

The IR schema carries `"$schema": ".../ir/v0"`. Within a major spec version: new optional slots and types may appear (minor); nothing is removed or re-typed. Exporters declare the IR spec range they support; core refuses mismatches with a clear diagnostic rather than corrupting output.

**Cross-target value contracts.** Some *derived values* are shared by multiple exporters and therefore constitute an ABI stronger than rule-pack pinning: they may not change even across rule-pack versions without a major. The first such contract: **`palette.categorical.1–5` are frozen** — shadcn's `--chart-1…5` and ECharts' `color[]` consume the same entries, and "charts match across every target" is a product promise, not an implementation detail. Extending the palette appends entries only (5 → 8 was done this way, verified by byte-comparing shadcn output before/after). Any future shared derived value must be declared in this section when the second consumer appears.
