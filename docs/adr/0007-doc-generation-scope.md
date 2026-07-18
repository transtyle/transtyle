# ADR-0007: Own preview site first; upstream doc rebuild is experimental

**Status:** accepted

## Context

The vision's `--doc` flag rebuilds a target framework's own documentation site with the generated theme injected. Upstream docs sites are bespoke, unversioned-as-APIs builds (Hugo, custom Next.js monorepos) with docs licenses distinct from code licenses (e.g. CC BY for Bootstrap docs); maintaining N of these builds indefinitely would rival the cost of all exporters combined and violate the no-network/determinism build invariants.

## Decision

Three tiers ([doc-generation.md](../specs/doc-generation.md)): (1) our own deterministic themed preview site (`transtyle preview`, core feature, deploy-anywhere static output) — this carries the vision's deployability promise; (2) themed Storybook via the Storybook exporter for teams' own components; (3) upstream doc rebuild (`transtyle doc <target>`) as a per-exporter opt-in capability, permanently experimental, pinned-upstream-ref only, excluded from semver stability promises, and shipped only while a named maintainer keeps it green.

## Consequences

- The real user need (see and deploy your brand applied to an ecosystem) ships early, deterministic, and maintainable; improvements to the preview site benefit all targets at once.
- The spectacular demo (fully branded getbootstrap.com) is preserved as marketing-grade bonus without staking core credibility on upstream stability.
- Cost accepted: Tier 3 will break repeatedly and be dropped from unmaintained exporters — this is by design, and the "experimental forever" label is the contract.
