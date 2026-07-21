# Exporter spec: css-variables

> **Status: implemented** (`@transtyle/exporter-css-variables`).

**Why it exists** — two reasons, distinct from every other reference exporter: (1) it is the **executable specification of the plugin API** — the smallest possible `emit(normalized, ctx) → { files, coverage }` implementation, with no framework-specific mapping logic to obscure the contract, so third-party plugin authors and the Phase 2 conformance kit can diff against it; (2) it is a **framework-free escape hatch** for teams whose stack isn't one of the named targets — plain CSS custom properties are consumable from anything.

## Emitted artifacts

| File | Purpose |
|---|---|
| `variables.transtyle.css` | The complete resolved semantic catalog as `--custom-properties`, one per slot (or per composite sub-field) |
| `usage.md` | Install snippet, naming rule, dark-mode wiring |

## Naming

Strip the `semantic.` prefix, dots become dashes. Color-role grid cells and the content hierarchy keep their `color.` segment (`--color-primary-solid`, `--color-primary-on-solid`, `--color-text-base`, `--color-border`, `--color-ring`); the elevation ladder and `scrim` drop it, since they read as surfaces rather than role colors (`--elevation-1-surface`, `--elevation-1-shadow`, `--scrim`). Every other catalog area keeps its own top group unprefixed: `--radius-md` (+ `--radius-control`/`-field`/`-container`), `--space-4`, `--size-control-md`, `--border-width-thin`, `--breakpoint-md`, `--z-modal`, `--type-size-md`, `--duration-normal`, `--easing-standard`.

## Composite values

- `type.role.<role>.<size>` (DTCG `typography`) expands to four longhand properties: `-size`, `-weight`, `-leading`, `-family` (e.g. `--type-role-body-md-size`).
- `elevation.N.shadow` (DTCG `shadow`) collapses to one box-shadow-shaped value: `<offsetX> <offsetY> <blur> <spread> <color>`, consumable directly as `box-shadow: var(--elevation-1-shadow)`.

## Mode handling

Mode polarity rule applies: `:root` always carries the **light** map, `[data-color-scheme="dark"]` the dark map (mode names, never the default flag — a dark-native DS like Cathode still emits this way). Only `semantic.color.*` slots (including the elevation ladder, which lives under `color.` internally) vary by mode and are duplicated across both blocks; every other catalog area is mode-invariant and appears once in `:root`. Override the dark selector via `options.darkSelector`; prefix every variable via `options.prefix`.

## Coverage

Every slot is `native` — there is no target-specific translation to lose fidelity over; this is the IR itself, rendered as CSS.

## Multi-dimension modes (T8)

This is the one exporter that expresses every configured mode dimension, not just `color-scheme`. For every dimension beyond the primary one (e.g. `density`), each non-default value that changes at least one slot gets its own selector block — `[data-density="compact"]` by default, or `options.dimensionSelectors.<dim>` (a template string containing `{value}`, e.g. `".density-{value}"`). The block contains only the slots whose rendered value actually differs from the all-defaults combo — a diff, not a re-dump, so `density: compact` on Acme (which only touches `space.*`) produces exactly 12 lines, not the full catalog again. Every other exporter only knows about the primary dimension and reports the rest `dropped(mode:<dim>)` (`droppedDimensions()`, `@transtyle/ir`).

## Role archetypes (T7)

No special-casing needed: custom roles declaring `$extensions.transtyle.role` (docs/architecture/ir.md §archetypes) get their full grid derived under `semantic.color.<name>.*` exactly like a built-in role, and this exporter already dumps every `semantic.*` slot it finds — an archetyped role's cells appear automatically, `native`, with no code change. See Cathode's `crt-amber` in `dist/css-variables/`.

## Ground-truth testing

None needed beyond the compiler's own determinism guarantee: the output is a direct, lossless projection of the resolved token graph, verified by `scripts/check-grid.mjs` (catalog completeness) and the demo projects (a plain HTML page consuming the file directly, no framework in between).
