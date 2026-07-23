# Exporter spec: PrimeNG

> **Status: implemented** (`@transtyle/exporter-primeng`). See [proposal 0002](../../proposals/0002-component-theming-primeng.md) and [docs/plan/component-tier.md](../../plan/component-tier.md) (C3–C6) for the full architecture analysis and build log.

**Why this exporter is different in kind, not just degree:** every other reference exporter binds at the semantic tier only. PrimeNG ships an explicit, first-party three-tier design-token system (`primitive` → `semantic` → `components`) and its own docs tell integrators to use component tokens "when customizing a specific component." This exporter is the first real proof that Transtyle's catalog — a flat meta-language, never grouped to match one target's shape (`CONTRIBUTING.md`) — can still drive a target with a genuinely richer component-token architecture, via a `definePreset(Aura, overrides)` override rather than a from-scratch preset.

## Emitted artifacts

| File                  | Purpose                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `preset.transtyle.ts` | A `definePreset(Aura, { semantic, components })` TypeScript module — override an existing PrimeNG preset, don't author one from zero |
| `usage.md`            | Setup snippet (`providePrimeNG`) + coverage summary                                                                                  |

## Strategy: one generic mapper, not ~90 hand-written tables

PrimeNG's per-component color grid (`variant × severity × state × part`) is isomorphic to the catalog's role grid (`prominence × role × state × cell`) — verified against Button's real source. `severity-grid.js` exports one function, `mapSeverityGrid`, applied against a small per-component shape descriptor (`descriptors.js`). `ramp.js` adapts `exporter-radix`'s ramp-projection technique (pin named grid cells to numbered steps, fresh-mix the one gap) to PrimeNG's 11-step `primary`/`surface` ramps.

**A real, corrective finding from verifying source rather than estimating:** far fewer PrimeNG components are severity-colored than first assumed. Only **Button**, **Tag**, **Badge**, **Message**, and **InlineMessage** carry the `severity × part` shape this pass covers. Components that looked like candidates from a distance — Checkbox, RadioButton, ToggleSwitch, SelectButton, ToggleButton, SplitButton — are actually **field-shaped** (single primary + neutral surfaces, no severity axis); ProgressBar, Slider, Knob, and Rating are **primary-anchored only**, with no `colorScheme` block in real PrimeNG at all — their own Aura default writes a bare token-reference string (e.g. `'{primary.color}'`) rather than a resolved color, and this exporter reuses that exact convention rather than resolving a mode-wrong literal.

## Archetype helpers (exporter-private, not new catalog vocabulary)

`field`/`list`/`navigation`/`overlay`/`content` (`archetypes.js`) read directly from existing `semantic.*` cells (`space.*`, `radius.*`, `text.*`, `elevation.*`). Per the [C1 cross-ecosystem study](../../findings/component-tier-study.md), none of these groupings is convergent across ecosystems — they live here **permanently**, not as a placeholder pending catalog promotion. Verified against real PrimeNG source (Checkbox/RadioButton/ToggleSwitch/Listbox/SelectButton for `field`; Listbox for `list`; Menu for `navigation`; Popover/Dialog for `overlay`).

**A real PrimeNG type-shape finding:** every one of these groups splits into a **mode-invariant top-level object** (padding/gap/radius/shadow-shape) and a **separate `colorScheme.{light,dark}.<group>` object** for anything color-ish — confirmed by compiling the emitted preset directly against PrimeNG's own `DesignTokens` TypeScript types, which reject a flat, unsplit object. This exporter computes both per-mode maps and assembles that split throughout.

## Custom archetype roles (T7) → PrimeNG's `extend`

A custom `semantic.color.<name>` role (declared via `$extensions.transtyle.role`) lands in Button's `extend.<name>.*` block — PrimeNG's own documented escape hatch for tokens outside its fixed severity schema (proposal 0002 §2.7). Proven on Cathode's `crt-amber` role archetype.

## Surface coverage (AL3 — measured, not asserted)

The denominator is [surface-inventory.json](../../../packages/exporter-primeng/surface-inventory.json), extracted from the real Aura preset (`@primeuix/themes`) and drift-guarded in CI: **2759 slots across 98 families** (97 components + the semantic tier). Every one is classified in `report.json`, in three honest shapes — which exist because PrimeNG resolves `{token}` references at runtime, so "not emitted" is not the same as "not themed":

| Reason           | Meaning                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **driven**       | this exporter emits the slot itself (Button's grid, the ramps, formField/list/navigation/overlay/content)                                                                                                  |
| **inherited**    | Aura's own default for the slot is a reference into a semantic path this exporter drives, so the component follows the theme without being named — real coverage, and how PrimeNG is designed to be themed |
| **Aura default** | a literal we don't override, or a reference into a semantic path we don't drive. Honest `unsupported`, always with a note                                                                                  |

Current split (identical across all four examples, since it depends on the exporter, not the design system): **79 driven · 1552 inherited · 1128 on Aura's default**. The bar earned its keep immediately: it exposed that `semantic.typography.*` was left on Aura's defaults, which cascaded to 60 component slots referencing `{typography.font.size}`/`{typography.font.weight}`. Driving four values from the IR's type scale converted 64 slots and made PrimeNG components render in the design system's own typeface and base size (Carbon's PrimeNG demo is now IBM Plex Sans at the Carbon base size, not Aura's `inherit`/0.875rem). Matching is deliberately **exact**: a prefix rule ("we drive some `formField.*`, so `{form.field.font.size}` counts") was implemented, measured to over-claim 221 slots, and removed — inflating coverage is the one outcome this bar exists to prevent.

Components with no builder yet (DataTable, Galleria, Tree, Splitter, Timeline, …) keep Aura's defaults. They are no longer listed from a hand-maintained array — the inventory measures them, so the list cannot go stale.

## Ground-truth testing

`examples/*/demo/primeng/` — real, standalone Angular applications (`providePrimeNG({ theme: { preset } })`), the first non-Vite/React demo profile in the repo (`docs/specs/demo-app.md`'s Angular profile). Every emitted preset is type-checked against PrimeNG's own `DesignTokens` types as part of `ng build` — a stronger verification path than any prior exporter gets from its own demo, since Vite doesn't type-check on build the way Angular's compiler does.
