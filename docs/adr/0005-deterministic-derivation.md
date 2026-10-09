# ADR-0005: Derivation is deterministic, rule-based, explainable

**Status:** accepted; **amended 2026-10-09** (see [Amendment](#amendment-2026-10-09-neutrals-are-not-the-brand))

## Context

"Intelligent automatic mapping" (fill `accent` from `primary`, infer `secondary`, auto-generate relationships) could be implemented as heuristic/ML inference or as declarative rules. The target audience — DS maintainers whose job is brand control — will reject any tool that invents values it cannot justify. The vision's own example ("infer secondary from the _closest available token_") is the kind of nearest-neighbor guess that is unstable under edits and impossible to explain.

## Decision

Derivation = versioned, pinned rule packs of pure functions over OKLCH color math and scale generators, evaluated on a DAG, filling only unauthored catalog slots, recording provenance for `transtyle explain` ([derivation.md](../architecture/derivation.md)). Rule packs are pinned in config; upgrades are explicit and diffable. Auto-dark-mode is opt-in. No ML, no environment-dependent heuristics, no arbitrary user JS in rules (declarative expression language only, v1).

## Consequences

- The minimal-config promise survives (one brand color → complete compilable system) with every generated value auditable — derivation becomes a trust feature instead of a trust risk.
- `check` can enforce team policy (require certain tokens authored; fail on excessive derivation).
- Cost accepted: rule packs will sometimes produce aesthetically mediocre values a human (or model) might beat; the answer is overriding, better rules in the next pack version — or AI _outside_ the compiler writing config (VISION non-goal #5).
- Cost accepted: the expression language will face pressure to grow; growth is an IR-spec-process decision, not an escape hatch.

## Amendment 2026-10-09: neutrals are not the brand

**What changed.** "Auto-dark-mode is opt-in" was written about brand colours, and it still holds for them: a role's `.solid` with no dark value carries over unchanged (`TST1204`), and `autoDark` changes only how that carry-over is classified. The page and its body text are not a brand decision. A design system that authors its body text (`text.base`) with no dark value and no page (`elevation.0.surface`) used to get its light text on the engine's default dark canvas, dark on dark at about 1:1: two fallback rules contradicting each other inside one mode, behind a `TST2101` warning ([issue #29](https://github.com/transtyle/transtyle/issues/29)). The standard rule pack now fills that pair by default, `autoDark` or not, with rule `swap-neutrals`: in the other polarity, the page takes the default mode's text colour and the text takes the default page.

**Why it is still this ADR.** The rule is a pure function of two default-mode values, recorded with provenance (`derived`, both inputs, the mode they are read from) and explained by `transtyle explain`. It is not a guess: five reference systems (Bootstrap, shadcn, Carbon, Radix, Material 3) set their dark page to their light text colour or close to it, and the swap keeps the pair's contrast ratio exactly. The precedent is `default-canvas`, which already picked a dark page by default.

**Its limits.** It runs only where the page is not authored at all and the text has no value of its own for that scheme (the same carry-over test as `TST1204`, on the resolved colour, so a text bound to a token with its own dark value is never touched). An authored page, even one with no dark value, is left as written: a modeless neutral is read as the author's choice for every mode, and fixing the `init` scaffold's modeless neutrals belongs to `init` (#99). It replaces a value the user wrote, if only in a mode the user did not write it for, so `TST1206` (`info`) says so every time. Under [ADR-0010](0010-pre-release-breaking-changes.md) the rule pack keeps the id `standard@1`.
