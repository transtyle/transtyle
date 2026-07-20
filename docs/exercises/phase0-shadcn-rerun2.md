# Phase 0 paper exercise — round 5: shadcn under the ratified (post-F19) rule pack

**Date:** 2026-07-19 · **Status:** complete, **clean** · **Exit criterion:** counter at 1 of 2

> **Note (2026-07-20):** the slot names used throughout this record (e.g. `.base`/`.subtle`/`.contrast`) predate the role-grid catalog revision — see `docs/adr/0010-pre-release-breaking-changes.md` and `docs/proposals/0001-universal-token-ir.md`. The *findings* below (F1–F21) remain valid evidence; only the vocabulary changed.

Method: the upgraded protocol from [round 4](phase0-shadcn-rerun.md) — an attempt is clean only if **both** probes pass: (a) the paper mapping against current specs needs no amendments, and (b) a value-level diff against real compiler output shows no *rule-level* disagreements. Round 5 is the first attempt run under this protocol from the start, and the first under the post-F19 rule pack.

## Probe (a): paper mapping — clean

The 33-variable mapping re-traversed against [ir.md](../architecture/ir.md) and the ratified [derivation.md](../architecture/derivation.md): all classifications stand (19 native · 12 derived · 1 approximated · 1 exporter-convention, as in round 1). No catalog slot missing, no rule hole, no new watch items. F19's walk introduces no mapping change — it changes *which value* fills `text-on-<role>.subtle`, not which shadcn variable consumes it.

## Probe (b): output diff — all 16 deltas classified, zero rule disagreements

The historical round-1 expected file differs from current `dist/shadcn/` output in 16 values. Every one classifies as hand-run artifact, none as rule disagreement:

| Class | Count | Examples |
|---|---|---|
| Hand-rounding noise (documented in round 1 as "indicative only") | 8 | `--accent` chroma 0.02 vs computed 0.017; `--muted` L 0.96 vs computed mix 0.9502; dark mixes approximated with gray.800 (0.3) vs computed 0.246 |
| Round-1 hand errors (recorded in round 4) | 2 | dark `--destructive` ("danger.hover as dark base" — no such rule); dark `--chart-1` chroma 0.17 (hand assumed blue.500 alias; the palette rule carries `primary.c` = 0.18) |
| Round-1 picks superseded by the ratified F19 walk | 6 | light `--secondary-foreground` 0.22 → 0.48 (neutral.active clears AA at 5.65:1, walk stops at step 0); dark `--accent-foreground` 0.75 0.12 (hand's comfort-margin guess) → 0.63 0.162 (first AA step, 4.58:1) |

**Independent verification of the walk (F19 regression probe):** the ratified rule was re-implemented from the *spec text* in a throwaway script — sharing only colorimetry (`color.js`) with the compiler, not the rule logic — and hand-stepped for four roles in both modes. Every shadcn-consumed value agrees with `dist/` exactly: light picks at step 0 (`0.48 0.011` / `0.48 0.162`), dark walks of 1 step (`0.63 0.011` at 4.62:1, `0.63 0.162` at 4.58:1). Caveat stated honestly: this verifies rule logic, not color math; colorimetry has separate ground-truth checks (round 1's hand-approximated ratios, e.g. white-on-primary 5.2:1).

**Retroactive cross-check against round 2:** the light `warning` walk lands at oklch(0.54 0.126 85) — dark on-brand amber, agreeing (within hand tolerance) with the Bootstrap hand map's `#7a5c12` for `warning`'s `-text-emphasis`. The pre-F19 code would have emitted near-black there: round 2's hand expectation *implicitly assumed the walk* nine findings before it was ratified. Had round 4 not caught F19, the Bootstrap re-run's output diff would have — the upgraded protocol closes both routes.

## Observations recorded (no amendments)

- **Hue behavior of `subtle` mixes:** ~~mixing is cartesian in OKLab, so a role's hue drifts toward the surface hue as chroma collapses~~ **[Erratum — corrected in round 6:** the symptom was real but this mechanism was wrong. The implementation at the time lerped hue in *polar* OKLCH; at t = 0.92 that lands near the cartesian result, which is how the misdiagnosis survived this round. Round 6's Bootstrap border tints (t = 0.70) exposed the difference — polar lerp routes amber through cyan — and [F21](phase0-bootstrap-rerun.md) pinned true cartesian OKLab in spec and code. The conclusion that dark subtle tints legitimately drift toward a chromatic surface's hue stands.**]**
- **Margin policy:** the walk stops at the first AA-passing step, so derived subtle foregrounds can sit at barely-AA (4.58:1). Deliberate: AA is the standard; wanting headroom is a `check` policy concern (a future `check.contrast.margin`), not a derivation concern. Watch, don't act.

## Verdict

**Clean on both probes — the counter stands at 1 of 2.** No spec, code, or catalog change was needed; the round's artifacts are this report and the verification runs.

Next: **round 6 — the Bootstrap re-run** under the ratified pack. Its probe (b) has no compiler to diff against (no Bootstrap exporter yet), so per protocol it diffs the hand maps against the *derivation engine's* resolved values (the target-independent part), which round 5 just validated for four roles. If round 6 is clean, the counter reaches 2 and the Phase 0 exit criterion is met.
