# 2026-07-21 — C1: cross-ecosystem component-tier study

Per [docs/plan/component-tier.md](../plan/component-tier.md) C1. Research/synthesis only — **no code change**, as the plan specifies. This is the highest-ambiguity task in the component-tier plan (the reason its model-suggestion table recommends Opus); it gates whether C7 promotes anything into the shared catalog.

## What the task had to settle

Proposal 0002 proposed grouping shared component tokens into five named objects (`field`/`list`/`navigation`/`overlay`/`content`) but validated that grouping against exactly one ecosystem (PrimeNG) plus one disagreeing spot-check (Spectrum, §2.8). C1 does the real pass — six systems, at proposal-0001's "verify against upstream" discipline — to answer: does any group appear as a *shared named grouping* in 3+ of the six, justifying promotion to `semantic.*`?

## What shipped

- **`docs/findings/component-tier-study.md`** (new) — one subsection per ecosystem (PrimeNG, Spectrum [reused], Material 3, Fluent 2, Ant Design v5, Chakra/Panda), each with a live source citation fetched 2026-07-21, classified on two axes (grouped-object vs. flat vocabulary; shared vs. per-component-namespace), plus the verdict table.
- **Proposal 0002 updated** — §2.8 gets a dated "Update (C1)" callout; §3's gap-table row 5 and §6's sequencing step 1 both updated to link the study and record the confirmed verdict.
- **ROADMAP** — C1 checked with its verdict inline; C7 marked skipped (struck through) since it was conditional on C1 finding convergence.

## The verdict

**Not convergent.** Only PrimeNG (1 of 6) groups shared component tokens into named objects. Of the five groups, only `field` has *any* second-system echo — Ant Design's flat `control*` alias family (`controlHeight`, `controlPaddingHorizontal`, `controlOutline`, `controlItemBgHover`), which is flat, not grouped, and doesn't clear a 3-of-6 bar. `list`/`navigation`/`overlay`/`content` are single-source. **All five stay exporter-private permanently; C7 is skipped.**

This *confirms* proposal 0002 §2.8's provisional resolution (reached from a single Spectrum spot-check) rather than overturning it — the full six-system pass reached the same place with real evidence.

## The finding that matters most

The one thing all six systems *do* share is one tier down: **component tokens alias a lower semantic/system tier** (Material 3's `md.comp.* → md.sys.*`, Fluent's control tokens → alias set, Ant's component tokens → alias/map, Chakra recipes → tokens, Spectrum's per-context tokens → numeric scale, PrimeNG's `components.* → semantic.*`). That is *exactly* the `component.* defaultFrom semantic.*` model C2 already built — so C1 independently validates the C2 engine design as the genuinely universal pattern, while narrowing what belongs in that tier's shared vocabulary to nothing new. The meta-language principle held under real scrutiny: faced with three mutually incompatible component-tier architectures, the agnostic answer was to keep the catalog a flat meta-language and let each exporter shape it — the second cross-ecosystem study (after proposal 0001) to return "add nothing new to the catalog."

## Deviation from the plan

None. The plan's file list (new findings doc + proposal 0002 §2.8/§3/§6 amendments) matches exactly what shipped; the ROADMAP ledger already existed (added earlier), so C1 only checked its box rather than creating the section.

## Verification

- All six ecosystem claims cited to live sources fetched 2026-07-21 (GitHub token source files for Material 3/Fluent global palette; official docs for Ant/Panda/Material naming; proposal-0002-reused fetches for PrimeNG/Spectrum). Material 3's per-component scoping and Panda's no-shared-grouping both confirmed against actual source/docs, not assumed.
- No code touched; `check:all` not re-run (nothing it covers changed) — this task is documentation-only by design.
