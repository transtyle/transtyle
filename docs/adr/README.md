# Architecture Decision Records

Format: [MADR](https://adr.github.io/madr/)-lite — Status / Context / Decision / Consequences (including what we gave up). ADRs are immutable once accepted; reversals get a new ADR that supersedes.

| # | Decision | Status |
|---|---|---|
| [0001](0001-compiler-architecture.md) | Compiler architecture with a central IR, not an exporter collection | accepted |
| [0002](0002-dtcg-superset-ir.md) | Source format is a DTCG superset, not proprietary | accepted |
| [0003](0003-tokens-first.md) | v1 ships foundations only; component layer deferred to v2 | accepted |
| [0004](0004-plugin-packaging.md) | Plugins are npm packages with static manifests | accepted |
| [0005](0005-deterministic-derivation.md) | Derivation is deterministic, rule-based, explainable | accepted |
| [0006](0006-version-ranges.md) | Target versions are compatibility ranges, not exact pins | accepted |
| [0007](0007-doc-generation-scope.md) | Own preview site first; upstream doc rebuild is experimental | accepted |
| [0008](0008-importers-first-class.md) | Importers are first-class frontends symmetric to exporters | accepted |
