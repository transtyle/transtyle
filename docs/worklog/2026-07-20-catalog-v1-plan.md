# 2026-07-20 — Proposal 0001 accepted (clean break); the catalog v1 plan

Maintainer decisions on [proposal 0001](../proposals/0001-universal-token-ir.md):

1. **Accepted**, with the compatibility posture inverted: Transtyle is unreleased, so **breaking changes are free** — catalog v1 replaces v0 outright (no aliases, one vocabulary forever). Recorded as [ADR-0010](../adr/0010-pre-release-breaking-changes.md); the v0 freeze banner is superseded and the freeze discipline re-arms at first npm publication.
2. The product stays **v1** — no version-numbering games.
3. The **sync rule is absolute**: any future modification updates code, docs/, website, README, and examples together (mechanized by `check:sync`, which V1-T3 extends with a dead-vocabulary guard so no v0 slot name can survive).
4. Implementation is to be executed by potentially lower-capability models, so the plan must be precise enough to follow mechanically.

## What was produced

- **[docs/plan/catalog-v1.md](../plan/catalog-v1.md)** — eleven tasks (V1-T1…T11), each with exact files, exact slot names, pinned formulas/values (grid state deltas, tint/outline mix ratios, elevation shadow table, type/space/motion/z/breakpoint defaults, Radix step mapping), step lists, acceptance commands, and the per-task process contract (build-twice determinism, `check:sync`, worklog, one pushed commit series per task).
- **ROADMAP Phase 1** rewritten as the ordered checkbox ledger over those tasks; Radix Themes exporter (V1-T9) is the grid's acceptance test and clean-attempt №1 toward re-freezing.
- **CONTRIBUTING** now points implementers at docs/plan/ with a no-improvisation instruction.
- Proposal 0001's status block records the amendment (flattened cell naming: `solid`, `solid-hover`, `on-solid`; §3.1 alias table reinterpreted as the rename table).

## Key design points fixed in the plan (so implementers don't decide them)

- Cell naming: rest is the bare prominence name (`primary.solid`), states suffix (`solid-hover`), on-colors prefix (`on-solid`). The authored anchor of a role is `<role>.solid`.
- Old surface slots become the elevation ladder itself (`elevation.0..5.surface`); `scrim` stays a standalone veil.
- Content ladder: `text.{strong,base,muted,subtle,disabled,inverse}` + `link.{base,hover,visited}`; `text.inverse` is an engine-owned cross-mode pass (removing the Storybook exporter's private F15 read).
- Promoted conventions must reproduce shipped fixture bytes: `tint` = old subtle (`#e7effa`), `outline` = F10's `#b7d2f4`, `on-tint` = `#005bb6` — asserted by `scripts/check-grid.mjs`.
- New tint/outline state ratios pinned: tint-hover 0.88, tint-active 0.84, outline-hover 0.55 (mix toward `elevation.1.surface`).
