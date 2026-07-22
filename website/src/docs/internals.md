---
title: 'Design & internals'
description: 'Where the architecture documents, specifications, and decision records live.'
order: 13
---

# Design & internals

This site documents _using_ Transtyle. The project's engineering documentation — written before the first line of code, and maintained since — lives in the repository and goes deeper on every topic here.

## The design-first history

Transtyle was fully specified on paper before implementation: architecture, IR, plugin contracts, versioning policy, and eight initial decision records. The specification was then validated by a "paper compilation" exercise (hand-translating a design system to shadcn), which found three IR flaws _before they became code_ — and the walking skeleton has been kept consistent with the specs since, each finding flowing back as a spec amendment.

## Repository map

| Path                 | Contents                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture/` | The compiler pipeline, IR specification (DTCG superset, tiers, catalog, modes), derivation engine, plugin system, versioning & compatibility model |
| `docs/specs/`        | Configuration, CLI, validation & coverage, doc generation, the v2 component layer, and per-exporter specs (Bootstrap, shadcn, ECharts, Storybook)  |
| `docs/adr/`          | Decision records — each with context, the decision, and the costs accepted                                                                         |
| `docs/exercises/`    | The Phase 0 paper-compilation reports                                                                                                              |
| `docs/prior-art.md`  | Honest competitive analysis: Style Dictionary, Terrazzo, Tokens Studio, Supernova, and the Diez post-mortem                                        |
| `packages/`          | `ir`, `core`, `exporter-shadcn`, `cli` — zero-dependency ESM                                                                                       |
| `examples/`          | Acme and Cathode, both compilable                                                                                                                  |

## The decision records, in one line each

1. **ADR-0001** — compiler with a central IR, not an exporter collection: N importers + M exporters = N×M paths for N+M cost.
2. **ADR-0002** — DTCG superset, not a proprietary format: interop is table stakes; extensions must be deletable when the spec catches up.
3. **ADR-0003** — foundations first; the component layer waits for evidence (and is component _theming_, never component generation).
4. **ADR-0004** — plugins are npm packages with static, reviewable manifests.
5. **ADR-0005** — derivation is deterministic, rule-based, explainable; no ML, no silent invention.
6. **ADR-0006** — target versions are compatibility ranges with mapping profiles, not per-patch promises.
7. **ADR-0007** — our own preview site first; rebuilding upstream framework docs is permanently experimental.
8. **ADR-0008** — importers are first-class frontends that emit reviewable source files, never IR internals.
9. **ADR-0009** — token sources stay pure DTCG; modes and bindings may live in separate layers.

## Contributing

The repo's `CONTRIBUTING.md` states the sync rule this project lives by: **a feature isn't done until the README, the specs, this website, and the examples all agree with the code.** Documentation drift is treated as a build failure of the project itself.
