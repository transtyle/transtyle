# ADR-0001: Compiler architecture with a central IR, not an exporter collection

**Status:** accepted

## Context

The initial vision framed the product as an "exporter": read a config, run a per-target generator. A flat config→generator design couples every generator to the config format, duplicates normalization/derivation logic per target, and makes ecosystem-to-ecosystem translation (Bootstrap → shadcn) a special feature to build rather than a property of the architecture.

## Decision

Structure the system as a multi-stage compiler: pluggable frontends (importers) produce a normalized intermediate representation; a shared middle (normalize, derive, validate) completes and checks it; pluggable backends (exporters) lower it to native artifacts. The IR is a versioned public contract ([ir.md](../architecture/ir.md)); the pipeline is fixed ([pipeline.md](../architecture/pipeline.md)).

## Consequences

- N importers + M exporters yield N×M translation paths for N+M implementation cost; Bootstrap→shadcn is `import` + `build`, not a feature.
- Derivation, contrast checking, provenance, and coverage are implemented once, benefiting every target uniformly.
- Cost accepted: the IR becomes a hard design bottleneck — it must be expressive enough for all targets yet stable enough to promise compatibility on. Phase 0 of the roadmap exists to de-risk exactly this, on paper, before code.
- Cost accepted: more upfront abstraction than a quick single-target script; the css-variables exporter exists partly to keep the abstraction honest against the simplest case.
