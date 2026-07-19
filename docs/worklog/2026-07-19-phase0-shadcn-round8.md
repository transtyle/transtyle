# Worklog — 2026-07-19 — Phase 0 round 8: shadcn clean — **exercise exit criterion met**

**Roadmap item:** Phase 0 IR validation, round 8 — the criterion-meeting round ([ROADMAP.md](../../ROADMAP.md) Phase 0).

## What was done

1. **Probe (a):** shadcn mapping re-traversed against the fully ratified pack — clean. F20's `contrast` slots correctly unconsumed by shadcn; F21's mix leaves consumed tints identical (the polar/cartesian near-coincidence on surface-hued subtles is precisely how F21 had stayed hidden).
2. **Probe (b):** round-5 value-diff re-run against a fresh build — the identical 16-delta set, value for value; shipped output confirmed byte-stable through F20/F21; all deltas carry their round-5 classifications. Clean.
3. **Fixture freshness sweep:** `expected/storybook/` regenerated engine-exact (it carried stale round-3 hexes) and verified with a scripted exact-match probe; one more hand-run slot collapse found and fixed (round 3 used one gray for both `neutral.subtle[dark]` and `border.base[dark]`) — fixture error, no rule ambiguity, no amendment. `expected/shadcn/` deliberately left historical; the Acme README now states each `expected/` directory's status explicitly.
4. **Verdict: rounds 7 and 8 are two consecutive clean attempts — the Phase 0 exercise exit criterion is MET**, with the scope limit recorded (non-color rules specced but unimplemented; Phase 1 ground-truth tests own that verification). Exit line marked in ROADMAP; website roadmap updated.
5. **Report:** [docs/exercises/phase0-shadcn-round8.md](../exercises/phase0-shadcn-round8.md) — includes the closing ledger summary: F1–F21 over 8 rounds, 7 accepted amendments, with F19–F21 findable only by machine-vs-hand diffs.

## Spec/doc sync (CONTRIBUTING.md sync rule)

- Code: none (that is the result).
- Specs: exercise report added; ROADMAP exit line annotated.
- Website: roadmap sequencing updated.
- README: Acme example README — `expected/` status wording rewritten.
- Examples: `expected/storybook/` regenerated engine-exact; `dist/` untouched.

## Next (Phase 0 remainder, then Phase 1)

- **Formal freeze declaration of IR spec v0 + plugin API v0** — the exit criterion was its prerequisite; this is the next roadmap task.
- Naming tail (domains, trademark search, repo rename) — needs the maintainer for registrar/legal actions.
- Phase 1 then opens fully: Bootstrap exporter implementation is the natural first item, consuming the engine-exact acceptance fixture the exercise produced.
