# Phase 0 paper exercise — round 6: Bootstrap re-run

**Date:** 2026-07-19 · **Status:** complete, two amendments (F20, F21) · **Exit criterion:** NOT met — counter reset to 0

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The _findings_ below (F1–F21) remain valid evidence; only the vocabulary changed.

Method: re-run round 2 ([phase0-bootstrap.md](phase0-bootstrap.md)) under the two-probe protocol. No Bootstrap exporter exists yet, so probe (b) diffs the round-2 hand values against the **derivation engine's resolved slots** — the target-independent part of the pipeline, dumped directly from `normalize → derive` and hex-formatted with the engine's own converter.

Findings continue the shared numbering; this round produced F20 and F21.

## Probe (a): paper mapping — clean

All round-2 mapping decisions re-traversed against current specs: classifications stand (F9–F13 hold; F8's ramp, F12's conventions, F13's fidelity boundary all unchanged). No new Bootstrap surface appeared.

## Probe (b): hand values vs engine — found F20 and F21

**F20 — Rule-pack gap (accepted): `<role>.contrast` was guaranteed but underivable.** The catalog has promised the `contrast` scale position since v0 — and [ir.md](../architecture/ir.md) says catalog slots are "guaranteed _and derivable_" — but no rule in the spec table and no fill in the engine produced it. The probe made it vivid: the engine returned **MISSING** exactly where round 2's hand files had consumed `neutral.contrast` — twice, with **two different hand values** (`$dark` #21242e vs `$body-emphasis-color` #121419), which is what consuming an undefined rule looks like from the inside. **Amendment:** `role.contrast = { l: text.base.l, c: role.c, h: role.h }` per mode — the role's hue/chroma re-anchored at text lightness. Chosen over an AAA-walk variant because it matches both of round 2's intended uses and Bootstrap's `$dark`/`$light` semantics, needs no new machinery, and anchors to an authored value. Ratified consequence for Acme: `neutral.contrast` light ≡ `text.base` (same anchor, same chroma) — the two inconsistent hand values collapse to one truth, and Bootstrap's emphasis ladder flattens on this fixture (a DS wanting distinct emphasis authors it). Applied to derivation.md and `derive.js`; no shipped output changes (nothing consumes the slot yet).

**F21 — Spec ambiguity with a live divergence (accepted): `mix` semantics were unpinned, and the implementation was polar.** The spec said only "mixed toward surface." The probe showed the dark `subtle`/border tints hue-shifted relative to round 2's hand values (hand assumed hue-preserving mixes) — and chasing the mechanism exposed that `color.js` lerped **hue in polar OKLCH** behind an achromatic guard (c < 0.01) that Acme's dark surface (c = 0.012) just barely misses. At the `subtle` ratio (0.92) polar lands near the correct result; at the border-tint ratio (0.70) it routes through unrelated hues — the probe's amber `warning` border came out **cyan** (#1c4b4f). **Amendment:** `mix` is pinned to **cartesian OKLab** (l/a/b, alpha linear) in derivation.md, and the implementation was brought into conformance. Post-fix the same border is dark olive (#4b422e). Shipped example outputs are byte-unchanged — verified — because no shipped exporter consumes the affected slots yet; the fix matters for the upcoming Bootstrap exporter's `-border-subtle` family.

**Erratum owned:** round 5's report had observed the dark-tint hue drift and blessed it as "cartesian mixing, correct behavior." Symptom right, mechanism wrong — at t = 0.92 polar and cartesian nearly coincide, which is how the misdiagnosis survived a clean round. The round-5 report now carries a struck-through erratum pointing here. Lesson recorded: an observation that explains a symptom is not verification of a mechanism; only the moderate-ratio case discriminated between the two implementations.

Everything else in probe (b) — role anchors, hovers, light subtles, the F19 walk values, scrim — agrees with the hand values within hand-approximation tolerance, with no further rule-level disagreements.

## Fixture regeneration

Per the Acme README, `expected/bootstrap/` is the acceptance fixture the future exporter will be checked against — so unlike the historical round-1 shadcn file, known-wrong values cannot stay. All **color** values in the three files were regenerated engine-exact (the original hand hexes remain in git history and are classified above); radius/type/spacing values remain hand-derived, since those rules are specced but not yet implemented. Two convention values were re-anchored to engine slots while at it: dark `--bs-link-color` ← `ring.base[dark]`, and the `light`/`dark` map keys now state their exact convention mixes.

## Verdict

**Two amendments — the counter resets to 0.** Both were invisible to paper-only probing: F20 needed the engine to return MISSING where hands had improvised, and F21 needed a moderate-ratio mix computed by machine to expose the polar/cartesian divergence. That is two rounds in a row where the machine-vs-hand diff found what spec re-reading could not — the protocol upgrade is earning its keep, and the remaining risk is plausibly concentrated in exactly this class (specced-but-unimplemented rules: radius, type scale, spacing, shadows).

Next: **round 7 — Bootstrap re-run** against the ratified pack and the regenerated fixture (probe (b) should now be an exact-match check over the color slots), then **round 8 — shadcn**. Two consecutive clean rounds are required; current count: 0.
