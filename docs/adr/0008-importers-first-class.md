# ADR-0008: Importers are first-class frontends symmetric to exporters

**Status:** accepted

## Context

The "Beyond Theme Generation" vision (Bootstrap → shadcn, Figma → Tailwind, ecosystem portability) requires reading existing ecosystems, not just writing them. This could be bolted on later as conversion scripts, or designed in now as the frontend half of the compiler ([ADR-0001](0001-compiler-architecture.md)).

## Decision

Importers share the plugin system (same packaging, manifest with `"kind": "importer"`, conformance kit). Contract: an importer emits the _source format_ (DTCG-superset token files), never IR internals — so its output is materializable (`transtyle import --write`), reviewable, and adoptable as ordinary authored files. Importers emit an import-coverage report symmetric to export coverage. v1 ships only the trivial DTCG importer; Tailwind/Figma arrive Phase 2, ecosystem importers (Bootstrap Sass, MUI theme) Phase 3.

## Consequences

- Ecosystem translation is architecture, not aspiration: `transtyle import bootstrap && transtyle build shadcn` composes two independently tested parts.
- The materialize-then-adopt flow keeps humans in the loop for lossy imports (imported systems are a starting point to review, not silent magic) and means importers can be one-shot migration tools _or_ repeated sync bridges without different machinery.
- Cost accepted: importing semantics from ecosystems that never declared them (which Sass variable _means_ "primary"?) is genuinely hard, mapping-opinionated work; import coverage reporting exists to make that opinionation visible.
- Emitting source format rather than IR sacrifices a little importer expressiveness for reviewability and decoupling from IR internals — deliberate.
