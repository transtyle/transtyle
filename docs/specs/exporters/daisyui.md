# Exporter spec: daisyUI

> **Status: implemented** (`@transtyle/exporter-daisyui`), era `v5` (Tailwind 4, `@plugin "daisyui/theme"` blocks, OKLCH-native). **Verify the exact v5 variable set against daisyui.com before npm publication** — implemented from known format, not re-checked against current docs. daisyUI 4 (Tailwind 3 config themes) could be a second era profile if demanded.

**Why it matters:** the first target whose `secondary`/`accent` are *true brand roles* — mapping is nearly 1:1 with the catalog (the anti-shadcn), which makes it the cleanest demonstration of the false-friends principle: same words, opposite mapping decisions, both correct.

## Artifacts

`daisyui.transtyle.css` — two `@plugin "daisyui/theme"` blocks (`<project>-light`, `default: true`; `<project>-dark`, `prefersdark: true`), colors in OKLCH — plus `usage.md` and `report.json`.

## Mapping highlights

Base ramp `base-100/200/300` ← `elevation.0.surface`/`elevation.1.surface`/`border` (base-300 `approximated`: daisyUI wants a third background step the IR doesn't define — catalog watch item alongside shadcn's `--input`). All role+`-content` pairs ← `<role>.solid` + `<role>.on-solid` (contrast-checked by derivation). `danger` → `error` (name translation). One authored radius feeds `--radius-{selector,field,box}` (`approximated`). `--depth`/`--noise`/`--size-*`: `dropped` — stylistic effects with no token semantics; daisyUI defaults apply.

**Role archetypes (T7):** daisyUI has an open color set — any `--color-<name>` custom property is a usable Tailwind utility color — so every role in `normalized.roleArchetypes` (custom `semantic.color.<name>` groups declaring `$extensions.transtyle.role`) gets `--color-<name>` + `--color-<name>-content` emitted alongside the built-in roles, `native`. This is the exporter the plan names for demonstrating the open-role-set path (contrast Bootstrap/shadcn's closed sets, which don't emit archetyped roles at all).

## Ground-truth testing (pending)

CI should build a fixture Tailwind 4 + daisyUI app with the generated blocks and assert computed styles on a component sample, per the standard exporter testing pattern.
