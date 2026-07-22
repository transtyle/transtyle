# ADR-0005: Derivation is deterministic, rule-based, explainable

**Status:** accepted

## Context

"Intelligent automatic mapping" (fill `accent` from `primary`, infer `secondary`, auto-generate relationships) could be implemented as heuristic/ML inference or as declarative rules. The target audience — DS maintainers whose job is brand control — will reject any tool that invents values it cannot justify. The vision's own example ("infer secondary from the _closest available token_") is the kind of nearest-neighbor guess that is unstable under edits and impossible to explain.

## Decision

Derivation = versioned, pinned rule packs of pure functions over OKLCH color math and scale generators, evaluated on a DAG, filling only unauthored catalog slots, recording provenance for `transtyle explain` ([derivation.md](../architecture/derivation.md)). Rule packs are pinned in config; upgrades are explicit and diffable. Auto-dark-mode is opt-in. No ML, no environment-dependent heuristics, no arbitrary user JS in rules (declarative expression language only, v1).

## Consequences

- The minimal-config promise survives (one brand color → complete compilable system) with every generated value auditable — derivation becomes a trust feature instead of a trust risk.
- `check` can enforce team policy (require certain tokens authored; fail on excessive derivation).
- Cost accepted: rule packs will sometimes produce aesthetically mediocre values a human (or model) might beat; the answer is overriding, better rules in the next pack version — or AI _outside_ the compiler writing config (VISION non-goal #5).
- Cost accepted: the expression language will face pressure to grow; growth is an IR-spec-process decision, not an escape hatch.
