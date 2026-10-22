---
title: 'PrimeNG exporter'
description: 'A definePreset(Aura, overrides) preset. It is the first target with its own three-tier component-token system, and the first Angular demo in the repo.'
order: 15
---

# PrimeNG exporter

<div class="callout live-demos">
  <span class="callout-title">See it live</span>
  <p><a href="/demo/acme/primeng/">Acme</a> · <a href="/demo/cathode/primeng/">Cathode</a> · <a href="/demo/govuk/primeng/">GOV.UK</a> · <a href="/demo/carbon/primeng/">Carbon</a> (one page, four design systems, compiled to PrimeNG). <a href="/demo/">All 44 demos →</a></p>
</div>

Every other reference exporter binds at the semantic tier only. PrimeNG ships its own explicit three-tier design-token system (`primitive` → `semantic` → `components`). So this exporter overrides an existing preset (`Aura`) rather than authoring one from zero. Anything it doesn't emit is inherited from Aura untouched.

<!-- measured: acme.primeng.rows = 363 -->

On [Acme](/docs/examples/) the emitted preset carries 363 classified slots, against the 2759-slot Aura surface the [coverage bar](/docs/concepts/#5-provenance-and-coverage) reconciles them with.

```json
"targets": { "primeng": { "output": "dist/primeng" } }
```

## One generic mapper, not ~90 hand-written tables

PrimeNG's per-component color grid (`variant × severity × state × part`) is the same shape as [the role grid](/docs/language/#color-roles-the-role-grid) (`prominence × role × state × cell`). One function, `mapSeverityGrid`, is applied against a small shape descriptor per component, not a value table.

**Verifying real source (not estimating) found far fewer severity-colored components than expected.** Only **Button**, **Tag**, **Badge**, **Message**, and **InlineMessage** carry that shape. Components that looked like candidates (Checkbox, ToggleSwitch, ProgressBar, Rating, and others) turned out to be field-shaped or primary-anchored-only instead, with no `colorScheme` block in real PrimeNG at all.

## Archetype helpers stay exporter-private

`field`/`list`/`navigation`/`overlay` read straight from existing catalog cells (`space.*`, `radius.*`, `text.*`, `elevation.*`). A [six-ecosystem study](/docs/roadmap/) found none of these groupings convergent across design systems, so they live inside this exporter permanently, not in the shared catalog.

## Custom roles → PrimeNG's `extend`

A custom color role (role archetypes) lands in `components.button.extend.<name>.*`, PrimeNG's own escape hatch for tokens outside its fixed severity schema. Proven on Cathode's `crt-amber` role.

## The first Angular demo in the repo

`examples/*/demo/primeng/` are real, standalone Angular applications, with `providePrimeNG({ theme: { preset } })` in `app.config.ts`. The build type-checks every emitted preset against PrimeNG's own `DesignTokens` types. That catches real structural mistakes a looser toolchain wouldn't have caught: a flat object where PrimeNG expects `{ light, dark }`, or a component-specific type narrower than the shared semantic group.

See it running: `npm run dev -w acme-demo-primeng` (or `cathode-demo-primeng`, `govuk-demo-primeng`, `carbon-demo-primeng`) in the [examples](/docs/examples/).

## Descriptions and deprecations

A property that maps exactly one slot carries that slot's `description` and `deprecated` as a `/** … */` JSDoc block above it (`Documented` and `jsdocComment()` from `@transtyle/ir`). The description shows on hover, and `@deprecated <reason>` strikes the property through in an editor. That covers the semantic typography, durations and disabled opacity, and the `colorScheme.light` primary, highlight, mask and text colours; the `dark` half maps the same slots and doesn't repeat them. The surface ramps, the archetype helpers and the component tier read several slots or a derived one and get none.

## Contrast, motion and brand

A preset has no runtime brand switch, so a design system declaring [`brand`](/docs/configuration/#contrast-motion-and-brand) gets one preset per brand, `preset.transtyle.acme.ts` and `preset.transtyle.globex.ts`; `usage.md` lists them. `contrast` and `motion` are reported `dropped`, each with its reason: a preset switches light and dark only, and its transition duration is one constant.
