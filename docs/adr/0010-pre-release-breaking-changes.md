# ADR-0010 — Pre-release breaking changes to the semantic catalog

**Status:** accepted, 2026-07-20; **amended 2026-08-30** (see [Amendment](#amendment-2026-08-30-the-alpha-does-not-arm-the-freeze)). Corrected 2026-07-20: the initial draft of this ADR mislabeled the revision as an "IR spec v1" version bump. It is not — see Decision 2.

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

## Amendment 2026-08-30: the alpha does not arm the freeze

**What changed.** The project is publishing its first release to npm as an experimental alpha (ROADMAP AL6). Read literally, decision 4 would arm the freeze the moment that lands: from `0.1.0-alpha.0` onward the catalog would be additive-only, and any vocabulary mistake found during the alpha could only be fixed by carrying a permanent alias. **Maintainer decision: it does not.** "First npm publication" in decision 4 means the first release published to the **`latest` dist-tag** — a non-prerelease. Prerelease versions (`0.1.0-alpha.x`, published under the `alpha` dist-tag) leave the pre-release regime of this ADR fully in force.

**Why this is the same decision, not a new one.** Decision 4 exists because publication creates users with a legitimate compatibility interest — that is the whole reason the discipline returns. An alpha published under a non-default dist-tag does not create that interest to the same degree: `npm install @transtyle/core` resolves to nothing until a `latest` release exists, so every alpha user has opted in explicitly, from a README and a website that both say breaking changes ship without a deprecation cycle. The original context line still applies almost unchanged — backward compatibility has near-zero value and real cost (a permanent double vocabulary) — and the cost of getting the vocabulary wrong is highest precisely when the first outside users are about to report it.

**What the alpha does change.** Decision 2's "version numbers start moving at first public release" is now satisfied: the alpha _is_ the first public release, so package versions begin moving with it. The `v0` designation of the IR spec, plugin API and config schema persists through the alpha and is locked at the first `latest` release, when [ADR-0011](0011-v0-freeze-readiness.md)'s audit takes effect as written.

**The obligation this exemption creates.** The exemption is only honest while the experimental status is impossible to miss. It is contingent on all three of: the alpha shipping under a non-`latest` dist-tag; the README carrying the alpha warning; and the website carrying its site-wide alpha banner. If the packages are ever promoted to `latest`, the freeze arms at that moment with no further decision required.

**What is unchanged.** Decisions 1, 3 and 5 in full — in-place revision, rule-pack semantics moving with regenerated fixtures and a worklog note, and the absolute sync rule. Nothing here authorizes a `v1` designation anywhere.
