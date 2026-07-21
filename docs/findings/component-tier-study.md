# Findings: cross-ecosystem component-tier architecture study (C1)

Per [docs/plan/component-tier.md](../plan/component-tier.md) C1. [Proposal 0001](../proposals/0001-universal-token-ir.md)'s 14-ecosystem study established the *color role grid* but explicitly deferred component-tier depth. [Proposal 0002](../proposals/0002-component-theming-primeng.md) proposed grouping shared component tokens into named objects (`field`/`list`/`navigation`/`overlay`/`content`) but validated that grouping against exactly **one** ecosystem (PrimeNG) plus one disagreeing spot-check (Spectrum, §2.8). This is the real pass: six ecosystems, at proposal-0001's "verify against upstream" discipline, scoped specifically to **how each system structures component-tier tokens** — grouped named objects (PrimeNG-style), flat precisely-named vocabulary (Spectrum-style), or something else.

**The question this answers:** do `field`/`list`/`navigation`/`overlay`/`content` appear as a *shared named grouping* in 3+ of the six systems — which would justify promoting them into Transtyle's shared `semantic.*` catalog (C7) — or are they PrimeNG's particular architectural choice, in which case they stay exporter-private permanently and C7 is skipped?

**Two independent axes** emerged as the useful way to classify each system, and they matter for the verdict:
- **Axis A — grouping:** does the system bundle shared component tokens into a small number of *named objects* (`formField.*`), or expose them as a *flat* list of individually-named tokens, or neither?
- **Axis B — sharing:** are component-level tokens *shared* across components (one definition many components read), or does each component get its *own namespace* that independently aliases a lower tier?

---

## PrimeNG (the source under test)

Structure already documented in [proposal 0002 §2.3–2.4](../proposals/0002-component-theming-primeng.md). **Axis A: grouped named objects.** **Axis B: shared** — `formField.*`, `list.*`, `navigation.*`, `overlay.*`, `content.*` are five named objects, each read by every component of that structural kind (`formField` by Button/InputText/Select/Checkbox/…). Below them, a per-component `components.<name>.*` namespace exists too, so PrimeNG is grouped-shared *and* per-component.

Source: `github.com/primefaces/primeuix`, `packages/themes/src/presets/aura/base/index.ts`, fetched 2026-07-21 (per proposal 0002).

**This is the only one of the six systems that groups shared component tokens into named objects.**

## Adobe Spectrum (reused from proposal 0002 §2.8, not re-derived)

**Axis A: flat vocabulary.** **Axis B: shared.** A large flat list of precisely-named per-context dimension tokens — `accessory-gap-{size}`, `accessory-item-padding-{size}`, `banner-padding-horizontal-compact` — one entry per component-or-context × t-shirt size × density, each usually aliasing the shared numeric spacing scale. **No single `formField.paddingX` a dozen components alias into**; a much larger vocabulary of specific names instead.

Source: `adobe/spectrum-design-data`, `packages/tokens/src/layout.json`, fetched 2026-07-21 (per proposal 0002 §2.8).

## Material 3

**Axis A: neither grouped-object nor flat-shared.** **Axis B: per-component namespace.** Three tiers — reference (`md.ref.*`), system (`md.sys.*`), component (`md.comp.*`). Component tokens live under **each component's own namespace** and alias system tokens: e.g. `--md-filled-button-container-color` maps to `var(--md-sys-color-primary)`. Verified directly against a component token source file (`_md-comp-filled-icon-button.scss`): every token is scoped `--md-filled-icon-button-*`, its values derived from `md-sys-color`/`md-sys-shape`/`md-sys-state` dependencies — **no shared "form field" grouping visible**; each component fully specifies its own tokens by aliasing the system tier.

There is no `md.comp.form-field.*` that InputField and Select both read; `outlined-text-field`, `filled-text-field`, etc. each carry their own complete token set. The sharing happens one tier down, at `md.sys.*` (the system/semantic tier), not via a shared component-archetype object.

Sources: `m3.material.io/foundations/design-tokens/overview` (token-class naming: `ref`/`sys`/`comp`); `github.com/material-components/material-web`, `tokens/_md-comp-filled-icon-button.scss`, fetched 2026-07-21.

## Fluent 2 (Fluent UI)

**Axis A: flat.** **Axis B: per-control tokens over flat alias tokens.** Three tiers — global (`Global.Color.Blue.60`), alias/"Set" (`Set.NeutralForeground1.Fill.Color.Rest`), and control tokens. Control tokens are named **under each control's own identifier**: the documented scheme is "(1) name of control (2) element (3) part (4) property (5) state," e.g. `ButtonPrimary.Base.Fill.Color.Rest`. The architectural rule is explicit: **"Controls should only depend on Control tokens,"** never directly on alias or global tokens — and each control's tokens map to the flat alias set. No shared `formField` object; the shared layer is the flat alias tokens (`colorNeutralForeground1`, `colorBrandBackground`, …) one tier below the per-control tokens.

Sources: `github.com/microsoft/fluentui`, `docs/architecture/design-tokens.md`; `microsoft.github.io/fluentui-token-pipeline/naming.html` (naming scheme); `packages/tokens/src/global/colors.ts` (global palette), fetched 2026-07-21.

## Ant Design v5

**Axis A: flat (for the shared layer).** **Axis B: hybrid — flat shared aliases *and* per-component namespaces.** Four tiers: seed (`colorPrimary`, `borderRadius`), map (`colorPrimaryHover`, `borderRadiusLG`), alias, and component tokens. Alias tokens are described as those that "control the style of some common components in batches" — and this is the closest any non-PrimeNG system comes to a shared form-control layer: `controlHeight`/`controlHeightLG`/`controlHeightSM`, `controlPaddingHorizontal`, `controlOutline`, `controlItemBgHover`/`controlItemBgActive`, `colorBorder`/`colorBorderDisabled`. These are genuinely **field-shaped shared concepts** (form-control height, padding, focus outline, hover background) — but they are **flat, individually-named tokens, not a grouped `formField` object**, and above them each component still gets **its own token namespace** ("different components will not affect each other").

So Ant confirms the *underlying need* `formField` addresses is real and shared — but solves it Spectrum-style (flat shared vocabulary), not PrimeNG-style (grouped object).

Source: `ant.design/docs/react/customize-theme`, fetched 2026-07-21.

## Chakra v3 / Panda CSS

**Axis A: neither.** **Axis B: per-component, fully standalone.** Component styling is expressed as **recipes** and **slot recipes** — each recipe is a self-contained unit (`slots`, `base`, `variants`) for one component. Verified against Panda's slot-recipe docs: **"no evidence of shared 'formField' or 'list' token objects that multiple components reference"**; each recipe independently specifies its structure and reads the design system's token layer directly. The checkbox slot recipe defines its own `root`/`control`/`label` slots — nothing shared with, say, a select recipe except the underlying tokens (`gap: '2'`, `borderRadius: 'sm'`).

Source: `panda-css.com/docs/concepts/slot-recipes`, fetched 2026-07-21.

---

## What converges, and what doesn't

**The `field`/`list`/`navigation`/`overlay`/`content` *grouping* is not convergent.** Only PrimeNG (1 of 6) bundles shared component tokens into named objects. Of the five groups, only `field` has *any* second-system echo — Ant Design's flat `control*` alias family (`controlHeight`, `controlPaddingHorizontal`, `controlOutline`, `controlItemBgHover`) — and even that is flat, not grouped, and doesn't clear a 3-of-6 bar. `list`, `navigation`, `overlay`, and `content` as named shared groupings are **single-source (PrimeNG only)** across the six systems.

**What *is* convergent** is one tier down, and Transtyle already has it:

1. **Component tokens alias a lower semantic/system tier.** All six systems do this: Material 3's `md.comp.* → md.sys.*`, Fluent's control tokens → alias set, Ant's component tokens → alias/map, Chakra recipes → tokens, Spectrum's per-context tokens → numeric scale, PrimeNG's `components.* → semantic.*`. This is **exactly the `component.* defaultFrom semantic.*` model built in C2** — so this study independently confirms the C2 engine design as the genuinely universal pattern, while rejecting the archetype groups as universal *vocabulary*.
2. **The shared form-control *need* is real** (form controls share height/padding/border/focus) — but the systems solve it with three different mechanisms: a grouped object (PrimeNG), a flat shared vocabulary (Spectrum, Ant), or per-component aliasing with no shared component-tier object at all (Material 3, Fluent, Chakra). There is **no convergent shape** to promote — which is precisely why the meta-language, not any grouping convention, is the thing that has to be agnostic (proposal 0002 §2.8). An exporter reads Transtyle's flat meta-tokens (`space.*`, `radius.*`, `border`, `text.*`, `elevation.*`) and emits whichever of the three shapes its target wants.

## Verdict table

For each proposed group: promote into shared `semantic.*` (C7) only if convergent as a *shared named grouping* in 3+ of the six systems.

| Group | Grouped-object systems (of 6) | Any-form echo | Verdict |
|---|---|---|---|
| `field` | PrimeNG only (1) | Ant's flat `control*` aliases (still flat, not grouped) | **Not convergent — stays exporter-private.** Closest to a candidate, but 1 grouped source + 1 flat echo ≠ 3-of-6. Re-evaluate only if a *second* exporter independently needs the identical grouping. |
| `list` | PrimeNG only (1) | none | **Not convergent — stays exporter-private.** |
| `navigation` | PrimeNG only (1) | none | **Not convergent — stays exporter-private.** |
| `overlay` | PrimeNG only (1) | none | **Not convergent — stays exporter-private.** Maps directly onto the existing `elevation.N.{surface,shadow}` ladder anyway; needs no new vocabulary. |
| `content` | PrimeNG only (1) | none | **Not convergent — stays exporter-private.** Maps onto `elevation.1.surface` + `border` + `text.*` inline; needs no new vocabulary. |

## Consequences

- **C7 is skipped entirely.** No group cleared the promotion bar, so nothing is promoted into `semantic.*`. Per the plan, exporter-private is a **permanent, fine end state** for all five groups, not a placeholder. This is the outcome proposal 0002 §2.8 provisionally reached from a single spot-check; the full six-system pass confirms it rather than overturning it.
- **C5 is unaffected** — it always shipped these as `@transtyle/exporter-primeng`-private helpers regardless of this verdict; that's now confirmed as the correct *permanent* home, not a waiting room.
- **C2's engine design is independently validated.** The one thing all six systems share — component tokens defaulting from a lower semantic tier — is exactly what C2 built. The study strengthens the case for the `component.* defaultFrom semantic.*` model as universal, while narrowing what belongs *in* that tier's shared vocabulary to nothing new.
- **The meta-language principle held under real scrutiny.** Faced with three mutually incompatible component-tier architectures (grouped / flat / per-component), the agnostic answer was never to pick one grouping convention for the catalog — it was to keep the catalog a flat meta-language of meanings and let each exporter shape it. This is the second time a cross-ecosystem study (after proposal 0001's role grid) returned "add nothing new to the catalog"; both times the discipline paid off.
