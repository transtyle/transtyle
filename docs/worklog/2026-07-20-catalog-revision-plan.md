# 2026-07-20 — Proposal 0001 accepted (clean break); the catalog revision plan

Maintainer decisions on [proposal 0001](../proposals/0001-universal-token-ir.md):

1. **Accepted**, with the compatibility posture inverted: Transtyle is unreleased, so **breaking changes are free** — the catalog is revised in place (no aliases, one vocabulary forever). Recorded as [ADR-0010](../adr/0010-pre-release-breaking-changes.md); the freeze banner is superseded and the freeze discipline re-arms at first npm publication.
2. **No version number changes.** This is not a "v1" — corrected same day: an earlier draft of this work mislabeled the revision as an IR spec version bump. It isn't one; the IR spec, plugin API, and config schema all stay `v0` (confirmed against the actual schema URLs, e.g. `.../schemas/config/v0.json`) through this and any future pre-release revision. Version numbers start moving only at first publication.
3. The **sync rule is absolute**: any future modification updates code, docs/, website, README, and examples together (mechanized by `check:sync`, which task T3 extends with a dead-vocabulary guard so no old slot name can survive).
4. Implementation is to be executed by potentially lower-capability models, so the plan must be precise enough to follow mechanically.

## What was produced

- **[docs/plan/catalog-revision.md](../plan/catalog-revision.md)** — eleven tasks (T1…T11), each with exact files, exact slot names, pinned formulas/values (grid state deltas, tint/outline mix ratios, elevation shadow table, type/space/motion/z/breakpoint defaults, Radix step mapping), step lists, acceptance commands, and the per-task process contract (build-twice determinism, `check:sync`, worklog, one pushed commit series per task).
- **ROADMAP Phase 1** rewritten as the ordered checkbox ledger over those tasks; Radix Themes exporter (T9) is the grid's acceptance test and clean-attempt №1 toward re-freezing.
- **CONTRIBUTING** now points implementers at docs/plan/ with a no-improvisation instruction.
- Proposal 0001's status block records the amendment (flattened cell naming: `solid`, `solid-hover`, `on-solid`; §3.1 alias table reinterpreted as the rename table) **and** the version correction (no "v1"; §7's original `standard@2`/additive-minor framing is superseded — the rule pack keeps its id `standard@1`, redefined in place).

## Key design points fixed in the plan (so implementers don't decide them)

- Cell naming: rest is the bare prominence name (`primary.solid`), states suffix (`solid-hover`), on-colors prefix (`on-solid`). The authored anchor of a role is `<role>.solid`.
- Old surface slots become the elevation ladder itself (`elevation.0..5.surface`); `scrim` stays a standalone veil.
- Content ladder: `text.{strong,base,muted,subtle,disabled,inverse}` + `link.{base,hover,visited}`; `text.inverse` is an engine-owned cross-mode pass (removing the Storybook exporter's private F15 read).
- Promoted conventions must reproduce shipped fixture bytes: `tint` = the old `subtle` value (`#e7effa`), `outline` = F10's `#b7d2f4`, `on-tint` = `#005bb6` — asserted by `scripts/check-grid.mjs`.
- New tint/outline state ratios pinned: tint-hover 0.88, tint-active 0.84, outline-hover 0.55 (mix toward `elevation.1.surface`).

## Correction log (same day)

The original pass through this decision (ADR-0010 draft 1, proposal status block draft 1, plan file named `catalog-v1.md`, task ids `V1-T1…T11`) used "v1" throughout, reading the maintainer's "stay in v1" instruction as authorization to bump a version number. It wasn't — the maintainer meant "don't create a second variant," under the mistaken premise that the project was *already* at v1, and corrected it on checking the actual schema files. Fixed in place: ADR-0010 rewritten, proposal status block rewritten, `docs/plan/catalog-v1.md` → `docs/plan/catalog-revision.md` (git-renamed), all `V1-T*` task ids → `T*`, ROADMAP ledger and CONTRIBUTING pointer updated, `ir.md`'s in-progress T1 edits (banner + catalog section) corrected in the same pass before anything downstream was built on the wrong labeling.
