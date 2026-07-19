# Phase 0 paper exercise — round 8: shadcn under the ratified pack

**Date:** 2026-07-19 · **Status:** complete, **clean** · **Exit criterion: MET** (rounds 7 and 8 — two consecutive clean attempts)

Method: the two-probe protocol against the fully ratified rule pack (post F19/F20/F21).

## Probe (a): paper mapping — clean

The 33-variable mapping re-traversed: all classifications stand. F20's new `contrast` slots are correctly *not* consumed by any shadcn variable (nothing in shadcn's set wants a text-anchored role variant), and F21's cartesian mix leaves every shadcn-consumed tint identical (the consumed subtles — neutral, accent — share the surface hue, where polar and cartesian coincide; that near-coincidence is exactly how F21 stayed hidden until Bootstrap's border tints).

## Probe (b): output diff — clean

The round-5 value-level diff re-run against a fresh build: **the identical 16-delta set, value for value** — confirming shipped shadcn output is byte-stable through F20/F21, exactly as those amendments promised, and every delta already carries its round-5 classification (8 hand-rounding, 2 documented round-1 hand errors, 6 picks superseded by the ratified walk). No new deltas, no rule-level disagreements.

## Fixture freshness sweep (secondary, applying round 6's principle)

Round 6 established that `expected/` files serving as acceptance fixtures must be engine-exact. Auditing the remaining fixtures:

- **`expected/storybook/`** carried stale round-3 hand hexes (pre-F19/F20/F21). Regenerated engine-exact and verified by the same scripted exact-match probe as round 7. The regeneration surfaced one more hand-run collapse worth recording: round 3 had used a single gray (#363b47) for two distinct slots — `neutral.subtle[dark]` and `border.base[dark]` — which the engine correctly distinguishes (#1d2127 vs #2a2e34). Same species as round 2's `neutral.contrast` inconsistency, caught by the same mechanism; no rule was ambiguous this time, so no amendment — the fixture was simply wrong and is now exact.
- **`expected/shadcn/`** is *not* regenerated, deliberately: its fixture role is superseded by the real exporter's own output (`dist/` + `report.json` are the snapshot surface). It remains the historical round-1 artifact; the Acme README now says so explicitly.

## Verdict

**Clean on both probes. Rounds 7 and 8 are two consecutive clean attempts — the Phase 0 exercise exit criterion is met**, on the evidence the current implementation can produce, with the recorded scope limit (non-color rules are specced but unimplemented; they get their verification in Phase 1 via the exporter ground-truth tests, and any friction there re-opens findings the normal way).

The exercise ledger closes at **21 findings (F1–F21) across 8 rounds**: 6 accepted amendments (F1, F2, F3, F8, F19, F20, F21 — where F19–F21 were only findable by machine-vs-hand diffs), the rest confirmations, conventions, watch items, and boundary decisions. What Phase 0 set out to prove — that the semantic catalog plus a deterministic rule pack can translate one authored DS to four dissimilar targets without per-target invention — held, and every place it initially didn't is now a named, ratified fix.

Remaining Phase 0 work (not gated on the exercise): the naming tail (domains, trademark search, repo rename) and the formal freeze declaration of IR spec v0 + plugin API v0, which this exit criterion was the prerequisite for.
