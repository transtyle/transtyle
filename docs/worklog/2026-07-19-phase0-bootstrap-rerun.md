# Worklog — 2026-07-19 — Phase 0 round 6: Bootstrap re-run (found F20 + F21)

**Roadmap item:** Phase 0 IR validation, round 6 ([ROADMAP.md](../../ROADMAP.md) Phase 0, third bullet).

## What was done

1. **Probe (a):** round-2 mapping re-traversed against current specs — clean, all classifications stand.
2. **Probe (b):** round-2 hand hexes diffed against the derivation engine's resolved slots (dumped via `normalize → derive`, hex-formatted by the engine). Two amendments:
   - **F20 — `<role>.contrast` was catalog-guaranteed but underivable.** The engine returned MISSING where round 2 had consumed `neutral.contrast` twice with two _different_ hand values. Ratified rule: role hue/chroma re-anchored at `text.base` lightness per mode (`contrast-anchor(text)`), implemented in `derive.js`. For Acme, `neutral.contrast` light ≡ `text.base` — the inconsistency collapses to one truth.
   - **F21 — `mix` semantics unpinned, implementation nonconforming.** Spec said "mixed toward surface"; `color.js` lerped hue in polar OKLCH behind a c < 0.01 achromatic guard that Acme's dark surface (c = 0.012) barely misses. At mix ratio 0.70 this routed amber border tints through **cyan**. Pinned to cartesian OKLab in derivation.md; `mix()` reimplemented; round 5's "cartesian" observation was symptom-right/mechanism-wrong and now carries a struck-through erratum pointing to round 6.
3. **Verified:** shipped example outputs **byte-unchanged** after both code changes (no shipped exporter consumes the affected slots); determinism gate passes; both examples build; `example:check` passes.
4. **Fixture regenerated:** all color values in `examples/acme/expected/bootstrap/` replaced with engine-exact hexes (it is the future exporter's acceptance fixture per the Acme README; hand hexes remain in git history, classified in the report). Non-color values stay hand-derived (their rules are specced, not yet implemented).
5. **Report:** [docs/exercises/phase0-bootstrap-rerun.md](../exercises/phase0-bootstrap-rerun.md).

## Spec/doc sync (CONTRIBUTING.md sync rule)

- Code: `packages/core/src/derive.js` (F20 fill), `packages/core/src/color.js` (F21 cartesian mix).
- Specs: derivation.md (F20 rule row; F21 mix-semantics paragraph); exercise report added; round-5 report erratum.
- Website: derivation page (`subtle` row corrected, `contrast` row added); roadmap sequencing updated.
- README: n/a (repo). CHANGELOG: two Changed entries (F20, F21).
- Examples: `expected/bootstrap/` regenerated; `dist/` byte-unchanged (verified, so no example behavior change).

## Verdict recorded

**Counter reset to 0** (two rule-pack amendments). Two consecutive machine-vs-hand probes have now caught what spec re-reading could not — the report names where residual risk likely lives (specced-but-unimplemented rules: radius, type scale, spacing, shadows). Next: round 7 (Bootstrap, expected exact-match on color slots), then round 8 (shadcn).
