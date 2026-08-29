# Architecture overview

## Framing: a compiler, not an exporter

The system is structured as a classic multi-stage compiler ([ADR-0001](../adr/0001-compiler-architecture.md)):

```
            ┌───────────── frontends (importers) ─────────────┐
  DTCG files   Tailwind config   Figma variables   Bootstrap Sass (later)
            └──────────────────────┬──────────────────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  LOAD      read + parse      │
                    │  NORMALIZE canonical IR      │
                    │  DERIVE    fill gaps (rules) │   @transtyle/core
                    │  RESOLVE   per-target map    │
                    │  EMIT      write artifacts   │
                    │  REPORT    coverage + diags  │
                    └──────────────┬───────────────┘
            ┌─────────────── backends (exporters) ─────────────┐
  Bootstrap   shadcn/ui   daisyUI   ECharts   Storybook   Radix   PrimeNG
                          css-variables (reference implementation)
            └──────────────────────────────────────────────────┘
```

Everything user-facing hangs off this spine: the CLI drives the pipeline, `check` runs it without EMIT, `explain` queries the provenance the pipeline records, `diff` runs it twice and compares IRs.

## Package layout

| Package                 | Responsibility                                                                             | Depends on |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------- |
| `@transtyle/ir`         | IR types, schema, validation. Zero runtime deps. The published spec artifact.              | —          |
| `@transtyle/core`       | Pipeline: loader, normalizer, derivation, resolver host, emitter, diagnostics, provenance. | ir         |
| `@transtyle/cli`        | Command surface, config discovery, plugin loading, output/UX.                              | core       |
| `@transtyle/plugin-kit` | Conformance suite for plugin authors — the executable plugin spec.                         | core       |
| `@transtyle/exporter-*` | One package per official exporter. Eight today.                                            | ir         |
| `@transtyle/importer-*` | _Planned._ One package per official importer; none exists yet.                             | ir         |

Design rules embedded in this layout:

- **`ir` is sacred and tiny.** Exporters depend on `ir` alone — not on `core`, and not even on `plugin-kit`, which is a checking tool the root scripts run over them rather than a library they import. This is what lets core refactor freely while plugins stay stable, and lets other tools (linters, editors) consume the IR without the compiler.
- **Monorepo, independent versioning.** Official exporters release on their own cadence (a Bootstrap release should not require a CLI release). See [versioning.md](versioning.md).
- **Core is a library first, CLI second.** Programmatic API (`compile(config)`) is public from day one — CI integrations, build-tool plugins (Vite, etc.) and the future preview server all consume it.

## Data flow contracts

Three data shapes cross public boundaries, and each is schema-versioned:

1. **Source config + token files** — authored by users ([specs/configuration.md](../specs/configuration.md)).
2. **The IR** — produced by NORMALIZE/DERIVE, consumed by exporters ([ir.md](ir.md)). Exporters receive a _resolved, immutable_ IR snapshot: all aliases resolved, all modes expanded, all derivations applied, provenance attached. Exporters never see raw user files.
3. **The coverage report** — `report.json` per target, produced by EMIT/REPORT ([specs/validation-and-coverage.md](../specs/validation-and-coverage.md)): schema-versioned JSON with a human rendering, consumed by CI and `diff` (and, planned, the preview site). The build _manifest_ that would sit beside it — emitted files plus content hashes, for orphan cleanup and drift detection — is still specced.

## Key invariants

- **Determinism:** identical inputs (config + tokens + plugin versions) produce byte-identical outputs. No timestamps, no randomness, no network access during build. Verified in CI by double-build comparison.
- **Isolation:** exporters cannot mutate the IR or affect other exporters — both enforced by `plugin-kit`'s conformance suite, not by convention. Exporters return _file descriptions_ (path + content); only core touches the filesystem, which is what makes `check` a real dry run (same code path, EMIT skipped) and what atomic writes and the manifest would build on once they exist.
- **Provenance everywhere:** every value in the IR knows whether it was authored, aliased, derived (by which rule, from what), or defaulted. This powers `explain`, coverage classification, and trustworthy diffs.
- **No network at build time.** Plugin installation (`transtyle add`) touches the network; `transtyle build` never does. Doc generation ([specs/doc-generation.md](../specs/doc-generation.md)) is the sole, explicitly-flagged exception.

## What is deliberately absent

- No runtime library shipped to user applications (see VISION non-goals; Diez post-mortem in [prior-art.md](../prior-art.md)).
- No component abstraction in v1 was the original position ([ADR-0003](../adr/0003-tokens-first.md)); the first alpha pulled the `component.*` tier forward, and it now ships on Bootstrap and PrimeNG with the ADR amended to say so. What remains absent is the rest of the component layer — component _intents_ mapped across ecosystems ([specs/component-layer.md](../specs/component-layer.md)).
- No plugin sandboxing in v1 — plugins are npm packages executing with full trust, like Babel/ESLint/Vite plugins. The trust model and its trade-offs are documented in [plugins.md](plugins.md#trust-model).
