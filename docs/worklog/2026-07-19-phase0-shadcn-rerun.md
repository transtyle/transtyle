# Worklog — 2026-07-19 — Phase 0 round 4: shadcn clean re-run (found F19)

**Roadmap item:** Phase 0 IR validation, round 4 ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Paper probe:** re-traversed the 33-variable shadcn mapping against the amended specs (post F1–F8). Clean — all round-1 classifications stand. One cross-target radius-consistency observation recorded (exporter-level, no amendment).
2. **Output probe (new):** value-level diff of the round-1 hand expectation against real `dist/shadcn/` compiler output. Structure matched 100%; value deltas separated into hand-rounding noise, two hand-run corrections (dark `--destructive`; subtle mix constant is 0.92, not ≈0.88), and **F19**.
3. **F19 — `contrast-pick(subtle)` had three conflicting definitions** (spec: on-brand preferred · property-test example: always max-contrast · code: first-AA-pass over `[active, text, white, near-black]`), diverging exactly when `role.active` barely misses AA (measured: 4.40:1 at L 0.62; one step to L 0.63 clears at 4.58:1). **Ratified resolution — the on-brand walk:** start at `<role>.active`, step lightness away from the subtle background in deterministic 0.01 increments until AA clears; max-contrast fallback only at the lightness clamp; `TST2101` now fires for `subtle` pairings too.
4. **Applied everywhere at once (sync rule):**
   - `packages/core/src/derive.js` — walk implemented; subtle AA warning added.
   - `docs/architecture/derivation.md` — rule row ratified.
   - `docs/specs/validation-and-coverage.md` — property-test example corrected (it overclaimed).
   - `website/src/docs/derivation.md` — rule description updated.
   - `CHANGELOG.md` — Changed entry (first behavior-change entry).
   - Exercise report: [docs/exercises/phase0-shadcn-rerun.md](../exercises/phase0-shadcn-rerun.md).
5. **Verified:** light-mode example output **byte-identical** (on-brand picks untouched); dark-mode subtle foregrounds now on-brand (`--accent-foreground` dark: plain text → lightened brand blue). Determinism gate passes (double build, byte-compare). Both examples build; `example:check` passes; site builds. Frozen `palette.categorical.1–5` untouched.

## Verdict recorded

Counter **reset to 0** (F19 is a rule-pack amendment, same class as F3/F8 — reclassifying it as "just a code bug" would game the criterion). Protocol upgraded: an "attempt" now = clean paper mapping **+** clean diff against compiler output where an exporter exists. The round's meta-lesson is recorded in the report: the ambiguity was invisible to spec-rereading and only surfaced because two independent executions (hand, machine) produced different bytes.

## Not done (deliberately)

- Round-1's historical hand-written expected file left as-is (it documents what round 1 believed; the report records the deltas).
- No new diagnostic code — `TST2101` wording already covers any contrast pairing.
- Round 5 (shadcn under post-F19 pack) and the Bootstrap re-run are the next tasks.
