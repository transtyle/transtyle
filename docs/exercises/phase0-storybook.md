# Phase 0 paper exercise — round 3: Storybook

**Date:** 2026-07-19 · **Status:** complete, no amendments needed · **Exit criterion:** first clean attempt (counter: 1 of 2)

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The *findings* below (F1–F21) remain valid evidence; only the vocabulary changed.

Method per [ROADMAP Phase 0](../../ROADMAP.md): hand-execute the pipeline for the [Acme fixture](../../examples/acme/) against the [Storybook exporter spec](../specs/exporters/storybook.md) (`>=8 <10`). Storybook is the meta-target: it themes a *tool's chrome* rather than a UI framework, and it is the only exporter that composes with sibling targets' outputs. Round 2 left a prediction: friction here should be **presentational** (mode switching, chrome constraints), not **semantic** (missing catalog slots) — if Storybook demanded new slots, that would be a surprise worth taking seriously.

Findings continue the shared numbering ([F1–F7](phase0-shadcn.md), [F8–F13](phase0-bootstrap.md)); this round produced F14–F18.

## Inputs

Same fixture, unchanged: **Acme**, 11 authored semantic tokens, `standard@1`, `autoDark: false`. Composition exercised with `options.previewTargets: ["shadcn", "daisyui"]` — deliberately the two configured siblings with *different* mode encodings (shadcn: `.dark` class; daisyUI: `data-theme="acme-design-system-{light,dark}"`, read from the real `dist/` artifacts).

## Derivation trace

No new derivation rules were needed — every ThemeVars slot was served by values rounds 1–2 already produced. Newly *consumed* (rules finding new consumers is the point of a meta-target round):

| ThemeVars slot | IR source | Note |
|---|---|---|
| `barHoverColor` | `primary.hover` | first chrome consumer of a role *state* |
| `booleanSelectedBg` | `surface-raised.base` | raise(surface) in both polarities |
| `inputBorderRadius` | `radius.sm` | **F8's rule finds its second consumer one round after acceptance** |
| `textInverseColor` | `text.base` of the *other* mode | cross-mode read → F15 |
| `appBorderRadius`, grid `cellSize` | `radius.md`, `space.4` | rem → px conversion → F16 |

Diagnostics: `TST2101` (text-muted borderline AA) surfaces a third time, identically — `textMutedColor` in chrome. Same fixture value, same check; the diagnostic's stability across targets is itself a (passing) test of the fixture-independence of checks.

## Mapping summary

Expected outputs with full inline provenance: [examples/acme/expected/storybook/](../../examples/acme/expected/storybook/) — `theme.transtyle.ts` (ThemeVars, light + dark), `manager.transtyle.ts`, `preview.transtyle.ts`. The optional `tokens.stories.transtyle.tsx` was **not** hand-written: it consumes the same resolved values with zero new IR pressure, so it has no paper-validation value; it stays implementation scope.

Hand-counted over the 25-slot ThemeVars surface × 2 modes: **~64% native · ~24% derived · ~8% approximated (unit conversion) · 1 config-sourced (`brandTitle`) · 2 unsupported (`brandUrl`/`brandImage`)**. The rest of the catalog (spacing/shadow/z/motion/type scales) is chrome-inexpressible → classified `dropped (chrome)` *with preview-path delivery noted* — the per-artifact coverage context the [coverage spec](../specs/validation-and-coverage.md) defined for exactly this case works as designed.

Output syntax note: colors emit as **hex**, not OKLCH — Storybook's theming pipeline transforms chrome colors internally (polished), which doesn't parse `oklch()`. This is the per-target output-syntax choice [ir.md](../architecture/ir.md#values-and-canonicalization) provides for; third target, third syntax (shadcn: oklch, Bootstrap Sass: hex, Storybook: hex-in-TS).

## Findings

**F14 — Prediction confirmed: zero semantic gaps at the meta-target.** Every ThemeVars slot mapped from existing catalog slots; no IR or rule-pack amendment needed. One wrinkle recorded for implementers: Storybook's `colorSecondary` is its *primary* highlight color (selection, links, focus) while `colorPrimary` is barely visible in modern chrome — both map from brand roles (`accent.base`, `primary.base`), and since Acme's accent aliases primary they coincide; a DS with a distinct accent gets Storybook chrome highlighted in accent, which is the right semantics.

**F15 — Design validation: cross-mode reads inside one artifact.** A light ThemeVars object needs `textInverseColor` — a *dark*-mode value (tooltips/inverse chrome). This is only expressible because exporters receive the **expanded mode matrix**, not per-mode slices ([ir.md](../architecture/ir.md#modes)). A per-mode-slice plugin API — the "simpler" design — would have failed here. First hard evidence for that architectural choice.

**F16 — Coverage class exercised: unit conversion.** `appBorderRadius`/`inputBorderRadius`/grid `cellSize` are unitless px numbers; our authored `0.5rem` converts via the config rem base (16) and is classified `approximated` — the first real consumer of the unit-conversion approximation class defined in [validation-and-coverage.md](../specs/validation-and-coverage.md). Also notable: `inputBorderRadius` consumes `radius.sm` from **F8's** multiplicative ramp — the round-2 amendment found a second consumer immediately, early evidence it was general rather than Bootstrap-shaped.

**F17 — Boundary decision (accepted, no IR change): brand identity metadata is not a token.** `brandTitle` sources from config `name`; `brandUrl`/`brandImage` have no home anywhere — and shouldn't get a catalog slot: a logo asset is not a design token, and inventing a token type for it would violate the DTCG-superset discipline. Decision: exporter option (`options.brand: { title?, url?, image? }`) at implementation time; `unsupported` in coverage when unset. This records where the token/metadata boundary is, which future exporters (e.g. a docs-site target) will hit again.

**F18 — Composition invariant held under real conditions.** One decorator drives two siblings with *different* mode encodings (`.dark` class + `data-theme` attribute), assembled purely from build-manifest metadata (artifact path + declared encoding) injected via `TargetContext` — exporters never read each other's resolutions ([plugins.md](../architecture/plugins.md)). The mode-polarity rule composed correctly too: the toolbar binds mode *names*; Acme's `default: light` only selects the chrome's static face (`manager.ts` uses the light theme; dark-native Cathode would get dark chrome) and the `initialGlobals` value. Chrome-static limits (manager theme and docs theme don't follow the toolbar without user wiring) are Storybook constraints, documented in `usage.md` scope — not IR friction.

**F7 revisited (third data point, still open):** chrome brand colors stay identical in both ThemeVars variants under `autoDark: false` — and unlike shadcn (where stock themes lighten brand in dark), Storybook chrome looks *normal* this way; `barSelectedColor` gets the dark-visibility lightening from the ring-style rule instead. Two of three targets now look fine with a constant dark brand; `darkBrandAdjust` stays deferred.

## Verdict

**Zero amendments — the first clean attempt.** The exit-criterion counter stands at **1 of 2 consecutive clean attempts**. The round's value was consumer-side: three round-1/2 amendments (F1's pairing values via docs stories scope, F3's ring rule via `barSelectedColor` lightening, F8's radius ramp via `inputBorderRadius`) plus two architectural choices (expanded mode matrix, manifest-only composition) all found real consumers and held.

Next: the **clean shadcn re-run** (round 4) against the post-F1–F8 specs. If it needs no amendments, the counter reaches 2 and the Phase 0 exit criterion is met; the ROADMAP also lists a Bootstrap re-run as confirmation. Risk assessment for round 4: low — rounds 2 and 3 already re-traversed most shadcn-relevant surface without friction.
