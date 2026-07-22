# Worklog — R2 freeze-readiness audit + R1 prep

**Task:** Phase A, R2 (drafted) and R1 prep (execution-2026-h2.md). On Opus 4.8.

## R2 — the freeze-readiness audit (ADR-0011, proposed)

The task as originally written ("freeze IR spec v0 + plugin API v0 together") was corrected by the audit itself. Two findings drove it:

1. **ADR-0010 already moved the real freeze to first publication** and reserves pre-release breaking changes. So R2 can't literally "declare frozen now" — it's a *readiness audit* that pre-verifies the v0 content so the R4 re-arm locks a known-good surface.
2. **The two surfaces are not equally ready.** Every IR-spec guarantee is verified against a named CI script (check-grid: 54 slots both modes + frozen hex; check-fixtures: the palette.categorical.1–5 cross-target contract; check-determinism: 4/4 byte-identical; check-cli: provenance/explain; T9/T11: zero-amendment generalization) — freeze-ready. But the **plugin API spec materially diverges from the implemented interface**: plugins.md documents `resolve`/`emit`/`doc` + declarative `mappings/*.json` evaluated by core + a semver-range manifest + a `plugin-kit` conformance harness; the reality is a single `emit(normalizedIR, ctx) → { files, coverage }` hook, JS mapping arrays, an era-string manifest, no load-time validation (audit A8), and no plugin-kit (it's P1). You can't freeze a contract the implementation doesn't honor.

**Decision:** freeze IR spec v0 at R4; **defer the plugin API freeze, gated on P1** (the conformance kit is where spec and implementation reconcile). Every unready promise got an explicit exclusion + named gate (plugin API → P1; report/config schemas → R3/A7; transtyle.lock → unimplemented/A4).

**Applied consequences:** plugins.md carries a drift banner (implemented interface vs the P1 target); P1's acceptance in the plan now owns the reconciliation + banner removal; ADR index + ROADMAP R2 (`[~]`) + the ledger R2/P1 entries updated. ADR-0011 is `proposed` — it ratifies (flips to `accepted`) when R1 signs.

## R1 prep (cannot sign — human-only)

Re-verified the engineering evidence is current and added a dated evidence block to the T11 checklist: GOV.UK + Carbon both zero-diagnostics today, determinism 4/4, check:all 35 ✔. Added the **PrimeNG rows** (8th target, ports 4307/4407) the checklist predated. The checklist is now ready for the maintainer's practitioner pass; nothing engine-side blocks it.

**Verified:** check:all 35 ✔; check:sync + check:docs green; no website drift (internals.md makes none of the contradicted plugin claims).
