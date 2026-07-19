# Worklog — 2026-07-19 — Phase 0 round 7: Bootstrap under the ratified pack (clean)

**Roadmap item:** Phase 0 IR validation, round 7 ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Probe (a):** all Bootstrap mapping decisions re-traversed against the post-F20/F21 specs — clean; the previously improvised `$dark`/`$body-emphasis-color` bindings now rest on F20's rule; the watch list is unchanged.
2. **Probe (b), mechanized:** a script parsed every hex value in the three fixture files (both modes), recomputed expectations from a fresh `normalize → derive` run plus the declared convention formulas, and compared — including `--bs-*-rgb` triplets against their hex neighbors. **Exact match on every engine-derivable value.** This also validated round 6's ~90-value fixture regeneration against transcription error.
3. **Standard gates:** determinism (double build, byte-identical), `example:check`, both examples build.
4. **Scope limitation recorded, not papered over:** radius/type/spacing/shadow fixture values remain hand-derived against specced-but-unimplemented rules — the same class F20 and F21 came from — and stay outside this probe until Phase 1 implements them.
5. **Report:** [docs/exercises/phase0-bootstrap-rerun2.md](../exercises/phase0-bootstrap-rerun2.md).

## Verdict recorded

**Clean on both probes — counter at 1 of 2.** No spec, code, or fixture changes were needed. Ledgers (ROADMAP, website roadmap) updated.

## Not done (deliberately)

- The probe script was not committed as tooling — it is transcribed in the report's description and belongs, properly generalized, in the Phase 1 exporter test kit (where the fixture becomes a real snapshot test).
- Round 8 (shadcn under the ratified pack) is the next task; **the Phase 0 exit criterion is met if it is clean**.
