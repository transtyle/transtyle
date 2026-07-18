# ADR-0004: Plugins are npm packages with static manifests

**Status:** accepted

## Context

The vision sketched plugins as file bundles (`resolver.json`, `mapping.json`, `generator.ts`…) possibly copied into a project. Alternatives considered: bespoke plugin archive format with our own registry; git-URL plugins; npm packages.

## Decision

A plugin is an npm package: declarative mapping profiles + a small programmatic interface (`resolve`/`emit`/`doc`), with a static `transtyle` manifest in `package.json` readable without executing code ([plugins.md](../architecture/plugins.md)). Official plugins live in the monorepo under `@transtyle/*`, independently versioned; community plugins are ordinary npm packages.

## Consequences

- Versioning, distribution, locking, deprecation, and org-scoped trust come free from npm; `transtyle.lock` reproducibility builds on it ([versioning.md](../architecture/versioning.md)).
- Static manifests enable pre-install review, registry tooling, and compatibility checking without arbitrary code execution.
- Declarative-first design (most exporters ≈ 90% mapping tables) keeps plugins introspectable and opens a future safe `declarative-only` plugin class.
- Cost accepted: full-trust code execution in v1 (the Babel/ESLint model) with its supply-chain risk — documented plainly rather than papered over.
- Cost accepted: Node/npm coupling. Fine for the audience; a future non-Node core would be a major-version conversation.
