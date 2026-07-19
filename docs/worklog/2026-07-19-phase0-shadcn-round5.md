# Worklog — 2026-07-19 — Phase 0 round 5: shadcn under the ratified rule pack (clean)

**Roadmap item:** Phase 0 IR validation, round 5 ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Probe (a) — paper mapping:** the 33-variable shadcn mapping re-traversed against the post-F19 specs. Clean; all round-1 classifications stand; F19 changes values, not bindings.
2. **Probe (b) — output diff:** all 16 deltas between the historical round-1 expected file and current `dist/shadcn/` output classified — 8 hand-rounding noise, 2 documented round-1 hand errors, 6 superseded by the ratified walk. **Zero rule-level disagreements.**
3. **Independent walk verification:** the F19 rule re-implemented from the spec text in a throwaway script (sharing only colorimetry with the compiler) and hand-stepped for four roles × two modes; every shadcn-consumed value matches `dist/` exactly (light step-0 picks at L 0.48; dark 1-step walks to L 0.63 at 4.58–4.62:1).
4. **Retroactive cross-check:** the light `warning` walk lands on dark on-brand amber, agreeing with round 2's Bootstrap `-text-emphasis` hand map — which pre-F19 code would have contradicted. Recorded as confirmation that the upgraded protocol would also have caught F19 via the Bootstrap route.
5. **Observations recorded, no amendments:** cartesian-mix hue drift in dark `subtle` tints is correct behavior (documented so it isn't misread as a bug); barely-AA results from the walk are a potential future `check.contrast.margin` policy knob, not a derivation concern.
6. **Report:** [docs/exercises/phase0-shadcn-rerun2.md](../exercises/phase0-shadcn-rerun2.md).

## Verdict recorded

**Clean attempt — counter at 1 of 2.** No spec, code, website, or example changes were needed (the sync rule is satisfied vacuously: nothing user-facing changed; ROADMAP and website roadmap ledgers updated to record the counter).

## Not done (deliberately)

- The historical round-1 expected file stays untouched — it documents round 1's beliefs; the report carries the delta classification.
- No CHANGELOG entry — no behavior change.
- Round 6 (Bootstrap re-run) is the next task: hand maps diffed against the derivation engine's resolved values (no Bootstrap exporter exists yet); if clean, the Phase 0 exit criterion is met.
