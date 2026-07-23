# Planning brief — the importer contract (what "map A to B" actually requires)

**Status: brief, not a scheduled plan.** This document defines the contract every importer must satisfy so that the ecosystem-to-ecosystem claim ("import from Bootstrap, export to shadcn/ui" — [VISION.md](../../VISION.md)) stays honest. It shapes how I1/I2/I4 and the Phase-3 framework importers get built; it schedules nothing by itself. Tasks below enter the ROADMAP ledger at the next planning pass, or attach to I1 when I1 starts — whichever comes first. Authority chain: [VISION.md](../../VISION.md) (the round-trip claim) → [pipeline.md](../architecture/pipeline.md) (importers emit DTCG-superset source, no private IR path) → [cli.md](../specs/cli.md) (`transtyle import <source> [--write]`) → this brief.

## Why this brief exists

Export is projection: the IR is richer than any single target, so an exporter's job is choosing what to keep, and the coverage report states what was lost. Import is the opposite problem — **inference**: a Tailwind config, a Bootstrap `_variables.scss`, or a hand-rolled stylesheet is _poorer_ than the IR in structure (no semantic tier, no modes discipline, component-scoped names) even when it is richer in raw values. "Map A to B" is `import A → IR → export B`, and its fidelity is capped by the weaker leg — today, always the import leg (one importer exists: DTCG; everything else is planned).

The evidence that import is judgment-laden, not mechanical, is already in the repo: the P4 hostile-adoption run ([hostile-adoption.md](../findings/hostile-adoption.md)) lifted a real product by hand and found **5 of 15 catalog bindings were contested judgment calls** that "no tool can settle." An importer that silently picks answers to those questions is manufacturing false confidence; an importer that surfaces them is automating the mechanical 10 of 15 and handing the human a short, explicit decision list. The second behavior is the contract.

## The contract (five clauses)

1. **Importers emit authored-equivalent source, never IR.** Already binding per [pipeline.md](../architecture/pipeline.md): an importer outputs the same raw DTCG-superset structure a human could have authored, materializable via `transtyle import --write` for review. No private path into the IR — imports stay inspectable, diffable, and re-compilable like any hand-written source.

2. **Import coverage mirrors export coverage.** Every import emits a report classifying each _source_ construct, the mirror image of [validation-and-coverage.md](../specs/validation-and-coverage.md)'s five export classes. Provisional mirror (final names are a spec decision in M1, and — per the agnostic-catalog discipline — must be validated against **two structurally different importers** before freezing, not designed from Tailwind alone):
   - `native` — source construct maps directly onto a catalog slot (`--bs-danger` → `semantic.color.danger.solid`);
   - `inferred` — lifted via heuristics (a palette synthesized from deduplicated literals, per the P4 playbook's "no palette? synthesize one" branch);
   - `approximated` — lifted, but meaning changed en route (a component-scoped variable rebound to a shared semantic slot);
   - `contested` — the importer proposes a binding but flags it as a judgment call a human must ratify (P4's 5-of-15 class);
   - `unmapped` — the source expresses it, the IR cannot. The import-side twin of export's `unsupported`, and the same kind of signal: `unmapped` constructs recurring across importers are catalog-growth data, exactly like `unsupported` slots recurring across exporters.

3. **Provenance survives the lift.** Every imported token records where it came from (file, line, original variable/key name), so `transtyle explain` answers "why is `primary` this value?" with "lifted from `_variables.scss:42` (`$blue`)" — the same trust mechanism the derivation engine already provides for generated values.

4. **Contested bindings are emitted as questions, not answers.** `--write` materializes them visibly in the output (a marked block with the candidates and the importer's suggested default), and the build refuses to treat an unratified contested binding as `native`. The P4 finding is the design bar: the human's irreducible work should be a short explicit list, never a silent guess buried in green output.

5. **Round-trip fidelity is measured, not asserted.** The honest metric for "map A to B" decomposes: _self round-trip_ first (`import A → export A` — how much of A's own theme survives, class by class), then A→B as import coverage × export coverage. The Phase-3 ROADMAP line "round-trip fidelity reporting" means shipping this arithmetic in the report, so the claim degrades gracefully into numbers instead of marketing.

## What this brief does _not_ do

It does not reorder I1/I2/I4 (I1 stays first per P4); it does not touch the semantic catalog (clause 2's `unmapped` class is _report_ vocabulary, not catalog vocabulary); it does not promise pixel equivalence (VISION non-goal 3 applies to imports doubly); and it does not start Phase-3 framework importers early — it only ensures I1 is built against the contract they will all share.

## Tasks (for the next planning pass)

| Task                                                              | Depends | Shape                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1** — Import-coverage spec section                             | —       | Extend [validation-and-coverage.md](../specs/validation-and-coverage.md) with the import classes (marked **provisional** until two importers exist), the contested-binding ratification rule, and the round-trip arithmetic. Doc-only; no code.                                              |
| **M2** — `transtyle import` contract tests in the plugin kit      | M1      | Extend `@transtyle/plugin-kit` conformance to importers: emits valid DTCG-superset, provenance present on every token, report classes legal, contested bindings round-trip through `--write`. The importer twin of what P1 built for exporters.                                              |
| **M3** — I1 (Tailwind) built against the contract                 | M1      | Amends I1's definition of done: it ships with an import coverage report and provenance, not just token output. First real data on whether the provisional classes fit.                                                                                                                       |
| **M4** — Second importer validates the vocabulary, classes freeze | M3      | I4 (CSS custom-properties — structurally the farthest from Tailwind, per P4 the Miniflux-shaped case) or Bootstrap-Sass, whichever the planning pass picks. The two-independent-consumers rule, applied to report vocabulary: only after M4 do the class names leave **provisional** status. |

**Suggested model per task** (judgment call, not a hard rule):

| Task | Suggested                                                | Why                                                                                                                                                                                     |
| ---- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1   | **Opus**                                                 | Spec vocabulary with long-term consequences (report classes are hard to rename once tooling reads them); mirrors the C1-style judgment work.                                            |
| M2   | **Sonnet**                                               | Extends an existing, well-shaped conformance kit (P1) with a parallel checklist; the design decisions land in M1.                                                                       |
| M3   | **Sonnet**, **Opus** fallback for the binding heuristics | Parsing a Tailwind config is mechanical; deciding which lifted values are `inferred` vs `contested` is the one judgment-dense sub-problem — escalate that alone if it fights back.      |
| M4   | **Sonnet**                                               | Second-implementation work against a now-real contract, plus a freeze decision that should get a human (R1-style) or Opus second look before the classes lose their provisional marker. |

**On Fable:** per the repo's standing note in [component-tier.md](component-tier.md) — no verified capability documentation to ground a recommendation on; check Anthropic's model docs before assigning it here.
