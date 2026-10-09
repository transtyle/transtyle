# Architecture Decision Records

Format: [MADR](https://adr.github.io/madr/)-lite — Status / Context / Decision / Consequences (including what we gave up). ADRs are immutable once accepted; reversals get a new ADR that supersedes.

| #                                            | Decision                                                                                                    | Status   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| [0001](0001-compiler-architecture.md)        | Compiler architecture with a central IR, not an exporter collection                                         | accepted |
| [0002](0002-dtcg-superset-ir.md)             | Source format is a DTCG superset, not proprietary                                                           | accepted |
| [0003](0003-tokens-first.md)                 | v1 ships foundations only; component layer deferred to v2                                                   | accepted |
| [0004](0004-plugin-packaging.md)             | Plugins are npm packages with static manifests                                                              | accepted |
| [0005](0005-deterministic-derivation.md)     | Derivation is deterministic, rule-based, explainable                                                        | accepted |
| [0006](0006-version-ranges.md)               | Target versions are compatibility ranges, not exact pins                                                    | accepted |
| [0007](0007-doc-generation-scope.md)         | Own preview site first; upstream doc rebuild is experimental                                                | accepted |
| [0008](0008-importers-first-class.md)        | Importers are first-class frontends symmetric to exporters                                                  | accepted |
| [0009](0009-token-layering.md)               | Token sources stay pure DTCG; modes and bindings may live in separate layers                                | accepted |
| [0010](0010-pre-release-breaking-changes.md) | Pre-release breaking changes allowed; freeze re-arms at first publication                                   | accepted |
| [0011](0011-v0-freeze-readiness.md)          | IR spec v0 freeze-ready; plugin API freeze deferred to the conformance kit (P1)                             | proposed |
| [0012](0012-binding-rules.md)                | Binding rules: the config declares data that expands into plain aliases at LOAD                             | accepted |
| [0013](0013-apca-optional-peer.md)           | APCA comes from the `apca-w3` package, an optional peer dependency of core                                  | accepted |
| [0014](0014-tokens-studio-input.md)          | Tokens Studio exports load in place, in core, as a layer form                                               | accepted |
| [0015](0015-mode-combinations.md)            | Combo layers; contrast, motion and brand as attribute, media or per-file blocks                             | accepted |
| [0016](0016-config-inheritance.md)           | A config can extend a base; the nearer file wins, token paths follow their file, outputs follow the product | accepted |
| [0017](0017-declarative-exporters.md)        | A mapping table may be an exporter, run by core's declarative runtime                                       | accepted |
