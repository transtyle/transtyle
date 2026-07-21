# 2026-07-21 — C3–C5: the PrimeNG exporter (severity mapper, ramp, archetypes)

Per [docs/plan/component-tier.md](../plan/component-tier.md) C3, C4, C5. Depends on C2 (done). Builds `@transtyle/exporter-primeng`, deliberately **not registered in the CLI** (process note 3 — C6 does that).

## What shipped

- **`packages/exporter-primeng/src/severity-grid.js`** — the one generic mapper (`mapSeverityGrid`). Resolves PrimeNG's `variant × severity × part` grid from the catalog's role grid (`solid`/`tint`/`outline`/`text` cells), same isomorphism proposal 0002 §2.4 verified against Button. Deliberately returns a flat, addressable lookup (`get(variant, severity, field)`) rather than a fixed tree shape — C4's real-source audit found PrimeNG nests inconsistently (Button is variant-major, Message is severity-major), so forcing one nesting convention here would misrepresent real output. `contrast` (not a Transtyle role) always resolves to two fixed cells (`neutral.text-strong` for background-ish parts, `elevation.0.surface` for foreground-ish parts) regardless of severity.
- **`packages/exporter-primeng/src/ramp.js`** — `projectRamp`, adapting `exporter-radix`'s technique (pin named grid cells to numbered steps, fresh-mix the one gap) to PrimeNG's 11-step `primary`/`surface` ramps. 9 of 11 steps land on a real grid cell natively; only step `800` needs a fresh mix — a better native ratio than Radix's own 2-of-12 gap.
- **`packages/exporter-primeng/src/archetypes.js`** — `field`/`list`/`navigation`/`overlay`/`content`, exporter-private per C1's confirmed verdict (no ecosystem convergence found). Every value reads an existing `semantic.*` cell — nothing added to the catalog.
- **`packages/exporter-primeng/src/descriptors.js`** + **`src/index.js`** — per-component builders and the `definePreset(Aura, { semantic, components })` TS emitter.

## The real finding that reshaped C4

Proposal 0002 §5.2 estimated ~25–35 severity-colored components by pattern-matching from Button alone. **Fetching and reading real source for 20 components (fetched 2026-07-21, `github.com/primefaces/primeuix`) found that estimate was too high** — most of the originally-assumed candidates are not severity-colored at all:

| Real shape | Components (verified) |
|---|---|
| Full grid (`variant × severity × part`) | **Button** only, of those checked |
| Flat (`severity × part`, no variant/state) | **Tag**, **Badge** |
| Flat + a `filled`/`outlined`/`simple` variant, severity-major nesting | **Message**, **InlineMessage** (also: neither has a `primary` severity — both use `info/success/warn/danger(named "error")/secondary/contrast` only) |
| Field-shaped (own tokens read `form.field.*`, no severity axis) | Checkbox, RadioButton, ToggleSwitch, SelectButton, Listbox's root |
| Primary-anchored only (no severity axis at all) | ProgressBar, Slider, Knob, Rating |
| Plain surface/neutral (no brand color) | Chip |
| Structural, near-zero color tokens of its own | ToggleButton (surface-neutral only, no severity), SplitButton (almost no color tokens — composes visually via Button) |

This is exactly the kind of variance the plan itself warned about ("Tag has no hover state... don't assume Button's shape generalizes uniformly") — but the *degree* of it is a genuine correction to record: **5 components use the severity mapper (Button, Tag, Badge, Message, InlineMessage), not ~25–35.** The mapper itself is still the right design — proven generic (same function, both a full-grid and two flat shapes) — there just turned out to be a smaller real audience for it than estimated. The remaining bulk of PrimeNG's ~82 components (86 preset folders minus `base`/`css`/`index.d.ts`/`index.ts`) are either archetype-helper consumers (below) or structural residue.

**Also real, not PrimeNG's polish**: PrimeNG itself is internally inconsistent about the "danger" severity's name — Button/Tag/Badge call it `danger`, Message/InlineMessage call it `error`. The exporter's severity resolver treats this as a per-component naming detail (each builder maps its own output key), not a bug to normalize away — Transtyle's `danger` role feeds both.

## Archetype helpers — real shapes, not the proposal's sketch

C1 confirmed `field`/`list`/`navigation`/`overlay`/`content` are exporter-private permanently. C5 implements them for real, and the shapes are now grounded in verified source rather than proposal 0002 §4's sketch: `field()` reads Checkbox/RadioButton/ToggleSwitch/SelectButton/Listbox's actual field-reference tokens; `list()`/`navigation()` read Listbox's/Menu's actual `list.*`/`navigation.*` references; `overlay()` reads Popover's/Dialog's actual `overlay.popover.*`/`overlay.modal.*` references (confirming a fourth kind, `overlay.navigation.*`, used by Menu's own `shadow`).

Each helper is proven on at least one real component, per C5's acceptance: `field` → Button's root structural tokens; `list` → Listbox; `navigation` → Menu; `overlay` → Popover (`popover` kind) and Dialog (`modal` kind).

## Structural residue

18 structural components (DataTable, Galleria, Tree, TreeTable, Splitter, Timeline, OrganizationChart, Carousel, DataView, OrderList, PickList, Paginator, Stepper, Steps, Tabs, TabView, Accordion) get an honest `unsupported` coverage entry each — they inherit Aura's own default untouched via the `definePreset` deep-merge, not silently. No attempt was made to give them bespoke token support in this pass; that's out of scope for what C3-C5 asked for.

## Verification performed (temporary script, not a permanent fixture, per C3's acceptance wording)

A throwaway script (written to the session scratchpad, not committed — matches the plan's own "temporary... not a permanent fixture" instruction) called `compile()` against Acme and Cathode directly, with a `loadExporter` that returns `@transtyle/exporter-primeng` regardless of name — bypassing the CLI registry entirely, per C3's acceptance criteria. Confirmed:
- The emitted `preset.transtyle.ts` is syntactically well-formed (balanced braces, no leaked `undefined`, valid `definePreset` import/export shape).
- `button.colorScheme.light.root.primary.background` exactly matches `semantic.color.primary.solid`'s resolved value.
- `tag.colorScheme.light.success.background` exactly matches `semantic.color.success.tint` (brand-coherent — hue-anchored off `primary`, not PrimeNG's literal `green` default) for both Acme and Cathode, which have different primary hues.
- Coverage output: 227 native · 8 approximated · 8 derived · 17-18 unsupported · 1 dropped (density, since this exporter only expresses `color-scheme` — same `droppedDimensions` convention every other exporter uses).

Also ran `npm run check:all` — clean, including the new `check:component-tier` step from C2 — confirming this work touched nothing in the shared catalog/derivation path.

## One small, justified core change

`packages/core/src/index.js` now re-exports `mix` alongside `formatColor`/`formatHex`/`contrastRatio` (previously internal-only, built into `compile()`'s exporter `ctx` but not part of `@transtyle/core`'s public surface). `ramp.js` needs `ctx.mix` the same way `exporter-radix` already does when invoked through the normal pipeline; exposing it lets the verification script (and any future exporter) construct that `ctx` when calling an exporter's `emit()` directly, bypassing the registry — exactly what C3's acceptance criteria requires. Purely additive; no existing behavior changed.

## Deviation from the plan

C4's real component count (5 severity-mapper components, not ~25–35) is the one real deviation, and it's recorded above with the reason (verified against source, per the plan's own instruction to verify rather than assume). Descriptor file organization used a single `descriptors.js` (the plan left "one file or several" as an implementation decision) since the verified set turned out small enough that per-component files would have been unnecessary ceremony.

## Not done in this pass

Extending coverage to more of the ~82 real components; the Angular demo project (C6); CLI registration and the five-surface docs sync (C6, which is exactly why this exporter stays unregistered until then).
