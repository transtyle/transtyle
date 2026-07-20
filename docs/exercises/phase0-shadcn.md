# Phase 0 paper exercise — round 1: shadcn/ui

**Date:** 2026-07-18 · **Status:** complete, findings applied · **Exit criterion:** not yet met (by design — see verdict)

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The *findings* below (F1–F21) remain valid evidence; only the vocabulary changed.

Method per [ROADMAP Phase 0](../../ROADMAP.md): take a design system authored in our source format, hand-execute the pipeline (normalize → derive → resolve → emit) against the [shadcn exporter spec](../specs/exporters/shadcn.md) (tailwind-v4 era), and record every point of friction as an IR finding. shadcn was chosen first deliberately: its variable set is nearly a 1:1 image of our semantic catalog, so friction here is IR signal, not target noise.

## Inputs

The **Acme** fixture DS: [examples/acme/](../../examples/acme/) — 11 authored semantic tokens (primary, background, surface, text, text-muted, border, radius.md, fonts; dark values for the 5 neutrals), 15 option tokens. Everything else derives. This deliberately exercises the minimal-input promise plus all four provenance classes.

## Derivation trace (standard@1, hand-applied)

Values are hand-approximated OKLCH, not computed — indicative only.

| Filled slot | Rule | Inputs | Light result |
|---|---|---|---|
| `accent.base` | alias-primary | primary | oklch(0.55 0.18 255) |
| `secondary.base` | desaturate-primary (C×0.35) | primary | oklch(0.58 0.06 255) |
| `danger.base` | hue-anchor(25), C/L matched | primary | oklch(0.55 0.19 25) |
| `success.base` / `warning.base` / `info.base` | hue-anchor(150/85/230) | primary | 0.60 0.14 150 / 0.76 0.14 85 / 0.58 0.15 230 |
| `neutral.base` | nearest neutral option scale | gray.500 | oklch(0.55 0.012 255) |
| `<role>.hover` / `.active` | L∓0.04/0.08 (flips in dark) | role base | e.g. primary.active 0.48 |
| `<role>.subtle` | mix(base, surface, ≈0.88) | role, surface | e.g. neutral.subtle 0.96 |
| `surface-raised.base` | raise(surface): toward white in light, +L in dark | surface | white / oklch(0.26 0.012 255) |
| `overlay.base` | alias surface-raised | — | (see **F2**) |
| `text-on-primary.base` | contrast-pick | primary | white — 5.2:1 AA ✓ |
| `text-on-<role>.subtle` | **rule did not exist** | — | **gap → F1** |
| `ring.base` | **rule did not exist** | — | **gap → F3** |
| `chart palette (5)` | categorical-palette, brand anchor | primary, accent | hues 255/25/150/85/310 |

Diagnostics the hand-run would emit: `TST2101` warning — `text-muted` vs `surface` in light mode ≈ 4.6:1, borderline AA (real finding about the fixture, and exactly the visibility the check exists for).

## Mapping table (shadcn tailwind-v4)

Full table in the expected output's inline comments: [examples/acme/expected/shadcn/globals.transtyle.css](../../examples/acme/expected/shadcn/globals.transtyle.css). Coverage summary of the 33-variable set: **19 native · 12 derived · 1 approximated (`--input` ← border) · 1 exporter-convention (sidebar family)**. Zero dropped, zero unsupported — confirming shadcn as the friendliest target.

## Findings

**F1 — Catalog gap (accepted): no foreground pairing for `subtle` backgrounds.** shadcn requires `--secondary-foreground`, `--muted-foreground`, `--accent-foreground` — text colors on *subtle* backgrounds. Our catalog only guaranteed `text-on-<role>.base`. Any target with tinted-background components needs this (Bootstrap `-text-emphasis` is the same concept — this would have resurfaced in round 2). **Amendment:** `text-on-<role>` becomes a scale `{base, subtle}`; contrast-pick rule extended. Applied to [ir.md](../architecture/ir.md) and [derivation.md](../architecture/derivation.md).

**F2 — Catalog ambiguity (accepted): `overlay` conflated two concepts.** Mapping `--popover` forced the question: is `overlay` a floating surface (popover/menu/dialog) or the dimming veil behind modals? The catalog said both, implicitly. **Amendment:** `overlay` = floating-layer surface, derived via raise(surface); new slot `scrim` = dimming veil, derived from a near-black at fixed alpha. Applied to ir.md and derivation.md; shadow composition now references `scrim` (previously, incoherently, `overlay`).

**F3 — Rule-pack gap (accepted): `ring` had no derivation rule.** Catalog guarantees the slot; standard@1 had no rule filling it. **Amendment:** `ring ← primary.base`, lightened in dark mode for visibility. Applied to derivation.md.

**F4 — Not a gap: `--input` vs `--border`.** shadcn distinguishes input borders from generic borders; the IR doesn't. Mapped `border.base`, classified `approximated`. Per the 3-exporter rule ([validation-and-coverage.md](../specs/validation-and-coverage.md)), one target wanting a distinction is not yet a catalog slot. Watch item.

**F5 — Validated: single-`--radius` derivation.** shadcn derives sm/md/lg/xl from one variable by calc; our `radius.md → --radius` maps natively and the rest of our radius scale is expressible through shadcn's own convention. No change.

**F6 — Not a gap: sidebar family.** `--sidebar-*` is a component-tier concern surfaced as globals. Mapped by exporter convention from surface/primary/accent; classified as exporter-convention derived. Belongs to the v2 component tier; no v1 catalog change.

**F7 — Design question surfaced (open, not blocking): brand color in dark mode.** With `autoDark: false` and no authored dark primary, `--primary` is identical in both modes — stock shadcn themes typically *lighten* brand colors in dark mode. Current behavior is correct per spec (we don't invent brand values), and the fix is one authored token or `autoDark: true`. Open question for the rule pack: should a future `standard@2` add an opt-in `darkBrandAdjust` rule class? Deferred until more targets weigh in.

**Positive result worth recording:** the brand-tinted `--accent` (derived from primary, vs stock shadcn's flat gray) is a visible quality win from semantic derivation — the generated theme is *more* on-brand than a typical hand-copied shadcn template. This is demo material.

## Verdict

11 authored tokens produced a complete, coherent 33-variable shadcn theme with full provenance — the minimal-input promise holds on paper. But round 1 produced **three accepted IR/rule-pack amendments (F1–F3)**, so per the exit criterion ("no IR changes needed for two consecutive attempts") the counter resets: shadcn must be re-run clean after these amendments, and rounds for Bootstrap, ECharts, and Storybook follow. Prediction to check in round 2 (Bootstrap): F1's `text-on-<role>.subtle` should map straight onto `-text-emphasis` — if it doesn't, F1's amendment was shadcn-shaped rather than general, and needs rework.
