---
title: 'css-variables exporter'
description: 'The plugin-API reference implementation and a framework-free escape hatch — every catalog slot as a plain CSS custom property.'
order: 13
---

# css-variables exporter

The simplest possible backend. Unlike every other reference exporter, it isn't really a _translation_ target — it's a 1:1 dump of the resolved semantic catalog as `--custom-properties`, with no framework mapping logic in the way. Two reasons it exists:

1. **The plugin API's reference implementation.** An exporter is exactly `emit(normalized, ctx) → { files, coverage }` — this one has nothing else going on, so it's what third-party plugin authors (and the Phase 2 conformance kit) diff their own exporter against.
2. **A framework-free escape hatch.** If your stack isn't Bootstrap, shadcn, daisyUI, or Storybook, you still get something consumable: plain CSS variables you can wire into anything.

```json
"targets": { "css-variables": { "output": "dist/css-variables" } }
```

```css
.my-button {
  background: var(--color-primary-solid);
  color: var(--color-primary-on-solid);
  border-radius: var(--radius-md);
}
.my-button:hover {
  background: var(--color-primary-solid-hover);
}
```

## Naming

Strip `semantic.`, dots become dashes. Color-role [grid](/docs/language/#color-roles-the-role-grid) cells and content keep their `color.` segment — `--color-primary-solid`, `--color-text-base`, `--color-border`. The elevation ladder and `scrim` drop it, since they're surfaces, not role colors — `--elevation-1-surface`, `--elevation-1-shadow`, `--scrim`. Everything else keeps its own top group: `--radius-md` (+ `-control`/`-field`/`-container`), `--space-4`, `--type-size-md`, `--z-modal`, `--duration-normal`, `--easing-standard`.

Composite values expand: a typography role (`type.role.body.md`) becomes four longhand properties (`-size`/`-weight`/`-leading`/`-family`); an elevation shadow collapses to one box-shadow-shaped value, usable directly as `box-shadow: var(--elevation-1-shadow)`.

## Mode handling

`:root` carries the light map, `[data-color-scheme="dark"]` the dark map — mode _names_, never the default flag, so a dark-native design system ([Cathode](/docs/examples/#cathode--the-hostile-example)) still emits this way. Only color slots vary by mode; scales (radius, space, type, motion…) are mode-invariant and appear once. Configure `options.darkSelector` and `options.prefix` to fit your setup.

## Coverage

Every variable is `native` — there's no target framework to lose fidelity translating into. This _is_ the IR, rendered as CSS. On Acme it's 450+ variables from 11 authored tokens.

## Extra mode dimensions

Most targets only know about `color-scheme`. This one expresses **every** dimension a design system declares: a second dimension like `density` gets one selector block per non-default value — `[data-density="compact"]` by default (override the attribute via `options.dimensionSelectors`) — containing only the variables that actually differ from the defaults, not a full re-dump. [Acme's demo](/docs/examples/#acme--the-minimal-example) declares `density: comfortable|compact`, scaling `space.*` by 0.875 in compact; every other target reports it `dropped(mode:density)` in coverage since they don't touch it.

## Custom roles (role archetypes)

Nothing target-specific to add: a custom role that declares `$extensions.transtyle.role` gets its full grid derived under `semantic.color.<name>.*` just like a built-in role, and this exporter already walks every `semantic.*` slot it finds — the archetyped role's cells show up automatically. See Cathode's `crt-amber` role in its `dist/css-variables/` output.
