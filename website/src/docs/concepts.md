---
title: "Core concepts"
description: "The pipeline, token tiers, semantic catalog, modes, and provenance."
order: 3
---

# Core concepts

Five ideas explain everything Transtyle does. Master these and the rest of the docs is reference material.

## 1. The compiler pipeline

Every build runs the same six stages:

<div class="flow" role="img" aria-label="The six pipeline stages in order: load, normalize, derive, resolve, emit, report — emit is the only stage that writes files">
  <span class="fnode">LOAD</span><span class="farr">→</span>
  <span class="fnode">NORMALIZE</span><span class="farr">→</span>
  <span class="fnode hi">DERIVE</span><span class="farr">→</span>
  <span class="fnode">RESOLVE</span><span class="farr">→</span>
  <span class="fnode">EMIT</span><span class="farr">→</span>
  <span class="fnode">REPORT</span>
</div>

| Stage | What happens |
|---|---|
| LOAD | Read `transtyle.config.json` and the token layers it lists |
| NORMALIZE | Merge layers, resolve aliases (with cycle detection), expand modes, parse colors to OKLCH |
| DERIVE | Fill every unauthored semantic slot using deterministic rules |
| RESOLVE | Map the completed token graph onto each target's native theming surface |
| EMIT | Write native artifacts (only this stage touches your disk; `check` skips it) |
| REPORT | Coverage classification + diagnostics, human and JSON |

Identical inputs produce byte-identical outputs — no timestamps, no randomness, no network.

## 2. The three-tier token model

<div class="tiers">
  <div class="tier">
    <span class="tier-name">option</span>
    <span class="tier-ex">color.blue.600 · font.mono</span>
    <span class="tier-desc">raw values — <strong>your</strong> private vocabulary, any names you like</span>
  </div>
  <div class="tier-link" aria-hidden="true">↓ alias</div>
  <div class="tier public">
    <span class="tier-name">semantic</span>
    <span class="tier-ex">primary.solid · text.base · elevation.0.surface</span>
    <span class="tier-desc">meaning — the stable public surface exporters bind to</span>
  </div>
  <div class="tier-link" aria-hidden="true">↓ alias</div>
  <div class="tier">
    <span class="tier-name">component</span>
    <span class="tier-ex">component.button.* (prototype)</span>
    <span class="tier-desc">per-component refinement — defaults from semantic; reserved for v2</span>
  </div>
</div>

Tiers are structural — the top-level group name (`option`, `semantic`, `component`) declares the tier. Exporters only ever bind to the **semantic** tier: you can rename your entire option palette tomorrow and no target output changes, as long as the semantic aliases still point somewhere sensible.

## 3. The semantic catalog

The catalog is the fixed set of semantic slots that exporters can rely on existing after derivation — the "instruction set" of the compiler. Every color role is a **grid**: prominence (`solid` fill, `tint` wash, `outline`, `text`) × interaction state (rest, `-hover`, `-active`, `-selected`), plus the paired foregrounds (`on-solid`, `on-tint`) — see [the language reference](/docs/language/#color-roles-the-role-grid) for the full shape and why a grid instead of a flat list.

- **Color roles** — `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info`, `neutral`. Each carries the full grid: `<role>.solid`, `<role>.solid-hover`, `<role>.tint`, `<role>.outline`, `<role>.on-solid`, `<role>.text`, `<role>.text-strong`, and so on.
- **Elevation** — `elevation.0.surface` through `elevation.5.surface` (the page, cards, raised panels, popovers…), each with a paired `elevation.N.shadow` for levels 1–4; `scrim` is the separate dimming veil behind modals.
- **Content** — `text.{strong, base, muted, subtle, disabled, inverse}`, `link.{base, hover, visited}`; `border`, `ring` as single-value slots.
- **Also** — `radius.*` (+ `control`/`field`/`container` family aliases), `font.*`, and defaulted scales for `space.*`, `size.control.*`, `border-width.*`, `breakpoint.*`, `z.*`, `type.*` (primitives and composite `type.role.*`), `duration.*`, `easing.*`.

You may add **custom semantic tokens** beyond the catalog — they're carried with full provenance and can be aliased by catalog slots. That's how a design system keeps its own vocabulary: see [the Cathode walkthrough](/docs/examples/#cathode--the-hostile-example).

## 4. Modes

A mode dimension is a declared axis of variation — the skeleton supports one, `color-scheme`, with values like `light`/`dark`. Every token resolves per mode; unspecified mode values fall back to the default-mode value.

Two equivalent authoring forms exist (inline `$extensions`, or separate mode-scoped files — see [Authoring tokens](/docs/authoring-tokens/#modes)), and one important rule: **`default` declares your design system's native mode; exporters bind mode names**. A dark-native design system still compiles correctly to shadcn's light-first `:root`/`.dark` structure.

## 5. Provenance and coverage

Every resolved value carries its origin:

| Provenance | Meaning |
|---|---|
| `authored` | You wrote this value |
| `aliased` | You pointed at another token |
| `derived` | A named rule computed it from your tokens |
| `defaulted` | A catalog constant, no user input involved |

And every emitted variable is classified in `report.json`:

| Coverage class | Meaning |
|---|---|
| <span class="sw" style="--c:var(--cov-native)"></span>`native` | The target has a first-class slot; lossless mapping |
| <span class="sw" style="--c:var(--cov-derived)"></span>`derived` | Synthesized by derivation, then mapped natively |
| <span class="sw" style="--c:var(--cov-approx)"></span>`approximated` | Mapped, but meaning changed (unit conversion, gamut clamp, concept mismatch) |
| <span class="sw" style="--c:oklch(0.55 0.02 262)"></span>`dropped` | Your system expresses it; this target can't; omitted with a reason |
| <span class="sw" style="--c:oklch(0.4 0.09 25)"></span>`unsupported` | The target has a themable slot Transtyle doesn't cover yet |

A build isn't "done" at 100% native — that's impossible across real ecosystems. It's done when the report matches your intent: your decisions authored, coherent derivation for the rest, every approximation known and accepted.

This is the trust mechanism: Transtyle never pretends translation is lossless — it measures the loss and shows you.
