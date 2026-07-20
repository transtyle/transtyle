# ADR-0010 — Pre-release breaking changes and the catalog v1 adoption

**Status:** accepted, 2026-07-20.

## Context

[Proposal 0001](../proposals/0001-universal-token-ir.md) redesigns the semantic catalog around the role grid. It was written to land as additive minors with permanent aliases, honoring the v0 freeze declared in [ir.md](../architecture/ir.md). The maintainer's decision: **Transtyle is unreleased — no npm package is published, no external user exists — so backward compatibility with v0 has zero value and real cost** (a permanent double vocabulary).

## Decision

1. **Catalog v1 replaces catalog v0 outright.** Old slot names (`<role>.base/hover/active/subtle/contrast`, `text-on-<role>.*`) are **removed**, not aliased. All in-repo consumers (exporters, examples, fixtures, demos, docs, website) migrate in the same change window.
2. **The version stays v1.** No v2 semantics games; the spec, once migrated, is "IR spec v1 (draft)" until first public release.
3. **The rule pack keeps the id `standard@1`** and its meaning is redefined by the v1 spec. Pre-release, rule semantics may change in place; every such change must ship with regenerated fixtures and a worklog note.
4. **The freeze policy re-arms at first npm publication.** From the first published version, the original discipline returns: additive minors, nothing removed or re-typed, rule semantics move only via a new rule-pack version. The FROZEN banner in ir.md is replaced by a pointer to this ADR until then.
5. **The sync rule is absolute during the migration** (CONTRIBUTING): any change to the catalog updates code, docs/, website, README, and examples in the *same* commit series, and `npm run check:sync` must pass. A migration-specific guard is added: no old-catalog slot name may survive anywhere in the repo (see plan task V1-T3).

## Consequences

- One vocabulary forever; no alias resolution machinery in NORMALIZE.
- Phase 0's *evidence* stays valid (the exercises validated meanings, not spellings); the exercise documents remain historical records and are not rewritten — a note at the top of the ledger points here.
- Implementation is sequenced and specified in [docs/plan/catalog-v1.md](../plan/catalog-v1.md); the ROADMAP orders it.
