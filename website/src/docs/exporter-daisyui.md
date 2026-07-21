---
title: "daisyUI exporter"
description: "Complete daisyUI v5 themes (light + dark) from your tokens — where 'secondary' finally means secondary."
order: 10
---

# daisyUI exporter

Emits **daisyUI v5** theme blocks (Tailwind 4 era): one `@plugin "daisyui/theme"` block per color-scheme mode, OKLCH values, light as `default`, dark as `prefersdark` — standard daisyUI multi-theme behavior, generated from your design system.

```json
"targets": { "daisyui": { "output": "dist/daisyui" } }
```

```css
/* your global CSS */
@import "tailwindcss";
@plugin "daisyui" { themes: acme-design-system-light --default, acme-design-system-dark --prefersdark; }
@import "./daisyui.transtyle.css";
```

## The interesting part: false friends, resolved correctly

daisyUI's `secondary` and `accent` are **true brand roles** — so this exporter maps them from `secondary.solid` and `accent.solid`. shadcn's identically-named variables are subtle surfaces — so that exporter maps them from `neutral.tint` and `accent.tint`. Same design system, same words, opposite mapping decisions, both correct: this is [the pivot-language principle](/docs/language/#false-friends) doing its job. Every role ships with its `-content` pair from `<role>.on-solid`, contrast-checked at derivation time.

## Mapping table

| daisyUI variable | Comes from | Note |
|---|---|---|
| `--color-base-100` / `-200` | `elevation.0.surface` / `elevation.1.surface` | |
| `--color-base-300` | `border` | `approximated` — daisyUI wants a third bg-ramp step the IR doesn't define (catalog watch item) |
| `--color-base-content` | `text.base` | |
| `--color-{primary,secondary,accent,neutral,info,success,warning}` + `-content` | the same-named roles' `.solid` + `.on-solid` grid cells | brand-direct |
| `--color-error` + `-content` | `danger.solid` + `danger.on-solid` | name translation |
| `--radius-{selector,field,box}` | `radius.md` | one radius feeds three families — `approximated` |
| `--depth`, `--noise`, `--size-*` | — | `dropped`: stylistic effects without token semantics; daisyUI defaults apply |

Because daisyUI wants every role authored-or-derived, coverage skews `derived` on minimal systems (Acme: 68% derived) — the report shows exactly which roles you might want to author. Both [examples](/docs/examples/) ship daisyUI targets.

## Custom roles (role archetypes)

daisyUI's color set is **open** — any `--color-<name>` custom property is a real Tailwind utility color — so a custom role declaring `$extensions.transtyle.role` (docs/architecture/ir.md's [role archetypes](/docs/language/#color-roles-the-role-grid)) gets `--color-<name>` + `--color-<name>-content` emitted alongside the built-ins, `native`. Cathode's `crt-amber` role (archetype `status`) demonstrates this: it's authored once, with no other bindings, purely to show the open-role-set path — contrast Bootstrap/shadcn, whose closed sets can't take it at all.
