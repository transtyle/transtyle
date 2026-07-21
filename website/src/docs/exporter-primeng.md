---
title: "PrimeNG exporter"
description: "A definePreset(Aura, overrides) preset — the first target with its own three-tier component-token system, and the first Angular demo in the repo."
order: 15
---

# PrimeNG exporter

Every other reference exporter binds at the semantic tier only. PrimeNG ships its own explicit three-tier design-token system (`primitive` → `semantic` → `components`), so this exporter overrides an existing preset (`Aura`) rather than authoring one from zero — anything it doesn't emit is inherited from Aura untouched.

```json
"targets": { "primeng": { "output": "dist/primeng" } }
```

## One generic mapper, not ~90 hand-written tables

PrimeNG's per-component color grid (`variant × severity × state × part`) is the same shape as [the role grid](/docs/language/#color-roles-the-role-grid) (`prominence × role × state × cell`). One function, `mapSeverityGrid`, is applied against a small shape descriptor per component — not a value table.

**Verifying real source (not estimating) found far fewer severity-colored components than expected**: only **Button**, **Tag**, **Badge**, **Message**, and **InlineMessage** carry that shape. Components that looked like candidates — Checkbox, ToggleSwitch, ProgressBar, Rating, and others — turned out to be field-shaped or primary-anchored-only instead, with no `colorScheme` block in real PrimeNG at all.

## Archetype helpers stay exporter-private

`field`/`list`/`navigation`/`overlay` read straight from existing catalog cells (`space.*`, `radius.*`, `text.*`, `elevation.*`). A [six-ecosystem study](/docs/roadmap/) found none of these groupings convergent across design systems — they live inside this exporter permanently, not the shared catalog.

## Custom roles → PrimeNG's `extend`

A custom color role (role archetypes) lands in `components.button.extend.<name>.*` — PrimeNG's own escape hatch for tokens outside its fixed severity schema. Proven on Cathode's `crt-amber` role.

## The first Angular demo in the repo

`examples/*/demo/primeng/` are real, standalone Angular applications — `providePrimeNG({ theme: { preset } })` in `app.config.ts`. Every emitted preset is type-checked against PrimeNG's own `DesignTokens` types as part of the build, catching real structural mistakes (a flat object where PrimeNG expects `{ light, dark }`, a component-specific type narrower than the shared semantic group) that a looser toolchain wouldn't have caught.

See it running: `npm run dev -w acme-demo-primeng` (or `cathode-demo-primeng`, `govuk-demo-primeng`, `carbon-demo-primeng`) in the [examples](/docs/examples/).
