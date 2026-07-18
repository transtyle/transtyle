# ADR-0006: Target versions are compatibility ranges, not exact pins

**Status:** accepted

## Context

The vision's CLI example targeted `bootstrap 5.3.8` — implying patch-level output fidelity. Framework theming surfaces change at minor boundaries (Bootstrap 5.2→5.3 CSS-var theming) and essentially never at patch level; promising per-patch accuracy creates an untestable combinatorial obligation and implies precision we cannot deliver.

## Decision

Exporters declare supported version *ranges* backed by mapping profiles; core selects the covering profile for a requested version and records both (requested version, selected profile) in the build manifest ([versioning.md](../architecture/versioning.md)). Uncovered versions fail with ranges listed; `--force-profile` is the explicit escape hatch. Narrow profiles remain possible when a patch genuinely changes theming.

## Consequences

- Testing obligation scales with profiles (a handful per exporter), not with every upstream release; CI ground-truth tests pin one representative version per profile plus latest-in-range.
- Users can still write `bootstrap@5.3.8`; the semantics are "the profile covering 5.3.8" — documented, honest, reproducible.
- Cost accepted: a genuine patch-level theming break between profile updates produces wrong output until the exporter narrows profiles — mitigated by scheduled latest-in-range CI catching upstream drift early.
