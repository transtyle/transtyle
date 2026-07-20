# Phase 0 paper exercise — round 7: Bootstrap under the ratified pack

**Date:** 2026-07-19 · **Status:** complete, **clean** · **Exit criterion:** counter at 1 of 2

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The *findings* below (F1–F21) remain valid evidence; only the vocabulary changed.

Method: re-run Bootstrap under the two-probe protocol, against the post-F20/F21 specs and the engine-exact fixture regenerated in [round 6](phase0-bootstrap-rerun.md).

## Probe (a): paper mapping — clean

All mapping decisions re-traversed against current specs: F9–F13 classifications stand; F20's `contrast-anchor(text)` rule serves the `$dark`/`$body-emphasis-color` bindings that were previously improvised; F21's pinned mix backs every `subtle`/border tint. The watch list is unchanged (F4 `--input`, F8 `xxl`, F10 per-role borders, F11 surface ladder). No new Bootstrap surface, no new gaps.

## Probe (b): scripted exact-match against the engine — clean

The probe was mechanized this round: a script parses **every hex value** in the three fixture files (`_variables.transtyle.scss`, `_maps.transtyle.scss`, `bootstrap-theme.css`, both modes), recomputes the expectation from a fresh `normalize → derive` run plus the declared convention formulas (border-subtle `mix 0.70`, the `light`/`dark` map-key mixes, dark link ← `ring.base[dark]`), and compares — including verifying each `--bs-*-rgb` triplet against its own hex neighbor. Result: **exact match on every engine-derivable value**. This also retroactively validates round 6's ~90-value hand transcription (a typo there was this round's most likely failure mode, and the probe was designed to catch it).

## Scope honestly stated

The exact-match probe covers the color slots — the part of the pipeline the engine implements. Radius, type-scale, spacing, and shadow values in the fixture remain hand-derived against specced-but-unimplemented rules; they are exactly the class both F20 and F21 came from, and they stay unverifiable by this probe until their rules are implemented (Phase 1, with the Bootstrap exporter and its ground-truth tests). The exit criterion is met or not on the evidence we can actually produce; this limitation is recorded rather than papered over.

## Verdict

**Clean on both probes — the counter stands at 1 of 2.** No spec, code, or fixture change was needed; the round's artifacts are this report and the probe script's run.

Next: **round 8 — shadcn under the ratified pack.** Its probe (b) re-runs the round-5 value-diff (which is already known to classify fully) plus the same freshness check against current `dist/` output. If clean, the counter reaches 2 and **the Phase 0 exit criterion is met**.
