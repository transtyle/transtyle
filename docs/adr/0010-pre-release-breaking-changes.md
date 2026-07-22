# ADR-0010 — Pre-release breaking changes to the semantic catalog

**Status:** accepted, 2026-07-20. Corrected same day: the initial draft of this ADR mislabeled the revision as an "IR spec v1" version bump. It is not — see Decision 2.

## Context

[Proposal 0001](../proposals/0001-universal-token-ir.md) redesigns the semantic catalog around the role grid. It was written to land as additive minors with permanent aliases, honoring the freeze declared in [ir.md](../architecture/ir.md). The maintainer's decision: **Transtyle is unreleased — no npm package is published, no external user exists, every schema is still `.../v0.json` — so backward compatibility has zero value and real cost** (a permanent double vocabulary).

## Decision

1. **The catalog is revised in place.** Old slot names (`<role>.base/hover/active/subtle/contrast`, `text-on-<role>.*`) are **removed**, not aliased. All in-repo consumers (exporters, examples, fixtures, demos, docs, website) migrate in the same change window.
2. **No version number changes.** This is not a bump to "IR spec v1" — the IR spec, the plugin API, and the config schema all stay at their current pre-release designation (`v0`) through this revision and any others before first publication. Version numbers start moving at first public release, not before. Do not write "v1" anywhere in connection with this catalog revision; call it "the revised catalog" or "the role grid," never a version.
3. **The rule pack keeps the id `standard@1`** and its meaning is redefined by the revision. Pre-release, rule semantics may change in place; every such change must ship with regenerated fixtures and a worklog note.
4. **The freeze policy re-arms at first npm publication.** From the first published version, the original discipline returns: additive minors, nothing removed or re-typed, rule semantics move only via a new rule-pack version. The FROZEN banner in ir.md is replaced by a pointer to this ADR until then.
5. **The sync rule is absolute during the migration** (CONTRIBUTING): any change to the catalog updates code, docs/, website, README, and examples in the _same_ commit series, and `npm run check:sync` must pass. A migration-specific guard is added: no old-catalog slot name may survive anywhere in the repo (see plan task T3).

## Consequences

- One vocabulary forever; no alias resolution machinery in NORMALIZE.
- Phase 0's _evidence_ stays valid (the exercises validated meanings, not spellings); the exercise documents remain historical records and are not rewritten — a note at the top of the ledger points here.
- Implementation is sequenced and specified in [docs/plan/catalog-revision.md](../plan/catalog-revision.md); the ROADMAP orders it.
- Nothing here authorizes bumping any version number. If a future change _does_ warrant a real version bump (e.g. after first publication), that is a separate, explicit decision — not an automatic consequence of this ADR.
