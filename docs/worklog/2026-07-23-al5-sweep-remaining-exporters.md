# Sweeping the other exporters for AL5-class defects

[AL5](2026-07-23-al5-diagnostics.md) fixed the defects it found in Bootstrap and css-variables and left `check:minimal-ds` behind as the guard. This pass asked whether the other six exporters carry the same class of bug, and whether the guard is actually looking in the right place.

## What the guard already covers, and what it structurally cannot

First, a broader emission probe than the guard runs: four sparse-but-legal design systems (the three-token floor, one with no `elevation.1`, a dark-native one, one with a border and a radius but no neutral ramp) × all 8 exporters, scanning for six leak shapes — `undefined`/`null`/`NaN`/`Infinity` on a value side, `[object Object]`, JS values inside a color function, empty declarations, empty strings, malformed hex.

**Clean, 0 findings.** The AL5 fixes hold, and no other exporter writes garbage on sparse input.

That result is also the limit of the approach. An exporter that correctly _skips_ an absent value leaks nothing and crashes nothing — and can still report the slot as covered. Silence plus a coverage claim is worse than either alone, because `report.json` is the artifact users audit.

So the second probe checked a different invariant, which is exporter-independent and needs no string matching: **every coverage row classed `native` or `derived` must name an IR slot that actually resolves.**

## Storybook: five ThemeVars claimed but never emitted

`appBorderColor`, `fontBase`, `fontCode`, `buttonBorder`, `inputBorder` — all `native` in the report, none present in the emitted theme.

The cause is a single fall-through:

```js
const provKind = map.get(slot)?.provenance.kind;
const klass = cls ?? (provKind === 'derived' ? 'derived' : 'native');
```

The class was computed from provenance, and **no entry means no provenance**, so an absent slot landed on `native` — the strongest claim the exporter can make. Emission was already correct (a `v === undefined` guard skips the var), so the theme was right and the report was wrong. Now an absent slot produces the same `dropped` row Bootstrap emits for the same cause, naming the slot to author.

## ECharts: one property, same shape

`axisLine/splitLine/tooltip.borderColor` claimed `native` from `semantic.color.border`. `JSON.stringify` drops undefined properties, so the theme correctly omitted them and ECharts' own defaults applied — while the row asserted coverage. Same fix, scoped to rows whose slot is a single resolvable path (the palette row's slot is a range label, not a path).

## Bootstrap: a regression from AL5's own fix, and a misattributed constant

Two findings, one of them mine:

1. **AL5's `dropUndefined` pass pushed a _second_ coverage row** instead of reconciling with the one the resolution pass had already written, so on a sparse system `$border-color` appeared **twice** — once `native`, once `dropped`. The emitted declaration is the ground truth: if it isn't in the file, no earlier claim about it survives. The pass now updates the existing rows rather than appending.

2. **`$border-radius-pill` was classed `derived` from `semantic.radius.full`** — but the exporter never reads that slot. `50rem` is a hard-coded Bootstrap idiom emitted unconditionally. The meaning maps exactly (both say "fully rounded"); the value is the target's own constant. That is precisely what `approximated` is for, and the old class also named a slot that need not exist — a design system with no radius scale has no `radius.full`, yet the pill still emits correctly.

## PrimeNG: a false positive worth fixing anyway

Two rows named `semantic.primary.color`, which the probe flagged. They're correct — that's **PrimeNG's own preset namespace**, a `{primary.color}` runtime reference, not an IR path. But `semantic.` prefixes both vocabularies, so a reader of `report.json` has no way to tell which one a row means. Relabelled `PrimeNG preset {primary.color} (runtime alias, not an IR path)`, which removes the ambiguity for readers and makes the guard exact rather than heuristic.

## The guard now checks it

`check:minimal-ds` gained assertion (4): no row classed `native`/`derived` may name an IR slot that doesn't resolve. Only single, complete IR paths are checked — many rows legitimately carry summary labels (`semantic.{font.sans, type.size.md}`, `semantic.color.primary.1–8`) or another vocabulary's namespace, and those are skipped rather than guessed at.

**Verified against the real defect**, not a synthetic one: restoring Storybook's original `entry?.provenance.kind` line makes the guard name all five original ThemeVars —

```
✘ minimal-ds check: 5 problem(s)
  - storybook: coverage row "appBorderColor" claims class native from
    semantic.color.border, which does not resolve — absence is not coverage
  …
```

Worth noting what this says about the earlier bar. AL3 measured coverage honestly against each target's _documented surface_, and that framing is what made "ALL tokens mapped" checkable. But it took the exporter's own class at face value. This assertion checks the class itself, and the two together are what make a coverage claim mean something: the denominator is measured, and the numerator can't be inflated by absence.

`check:all` green at 62; fixtures, determinism and plugin conformance unchanged (the examples author everything, so none of the new branches fires there — which is exactly why this needed a separate sparse-input harness).
