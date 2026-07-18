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
                    │  DERIVE    fill gaps (rules) │   @ds-exporter/core
                    │  RESOLVE   per-target map    │
                    │  EMIT      write artifacts   │
                    │  REPORT    coverage + diags  │
                    └──────────────┬───────────────┘
            ┌─────────────── backends (exporters) ─────────────┐
  Bootstrap      shadcn/ui      ECharts      Storybook      css-variables
            └──────────────────────────────────────────────────┘
```

Everything user-facing hangs off this spine: the CLI drives the pipeline, `check` runs it without EMIT, `explain` queries the provenance the pipeline records, `diff` runs it twice and compares IRs.

## Package layout (provisional names)

| Package | Responsibility | Depends on |
|---|---|---|
| `@ds-exporter/ir` | IR types, schema, validation. Zero runtime deps. The published spec artifact. | — |
| `@ds-exporter/core` | Pipeline: loader, normalizer, derivation, resolver host, emitter, diagnostics, provenance. | ir |
| `@ds-exporter/cli` | Command surface, config discovery, plugin loading, output/UX. | core |
| `@ds-exporter/plugin-kit` | Helpers + conformance test suite for plugin authors. | ir, core (test-only) |
| `@ds-exporter/exporter-*` | One package per official exporter. | plugin-kit (dev), ir |
| `@ds-exporter/importer-*` | One package per official importer. | plugin-kit (dev), ir |

Design rules embedded in this layout:

- **`ir` is sacred and tiny.** Plugins depend on `ir` and `plugin-kit`, never on `core`. This is what lets core refactor freely while plugins stay stable, and lets other tools (linters, editors) consume the IR without the compiler.
- **Monorepo, independent versioning.** Official exporters release on their own cadence (a Bootstrap release should not require a CLI release). See [versioning.md](versioning.md).
- **Core is a library first, CLI second.** Programmatic API (`compile(config)`) is public from day one — CI integrations, build-tool plugins (Vite, etc.) and the future preview server all consume it.

## Data flow contracts

Three data shapes cross public boundaries, and each is schema-versioned:

1. **Source config + token files** — authored by users ([specs/configuration.md](../specs/configuration.md)).
2. **The IR** — produced by NORMALIZE/DERIVE, consumed by exporters ([ir.md](ir.md)). Exporters receive a *resolved, immutable* IR snapshot: all aliases resolved, all modes expanded, all derivations applied, provenance attached. Exporters never see raw user files.
3. **The build manifest + coverage report** — produced by EMIT/REPORT ([specs/validation-and-coverage.md](../specs/validation-and-coverage.md)). Machine-readable (JSON) with a human rendering; consumed by CI, `diff`, and the preview site.

## Key invariants

- **Determinism:** identical inputs (config + tokens + plugin versions) produce byte-identical outputs. No timestamps, no randomness, no network access during build. Verified in CI by double-build comparison.
- **Isolation:** exporters cannot mutate the IR or affect other exporters. Exporters return *file descriptions* (path + content); only core touches the filesystem — this enables dry-runs, atomic writes, and the manifest.
- **Provenance everywhere:** every value in the IR knows whether it was authored, aliased, derived (by which rule, from what), or defaulted. This powers `explain`, coverage classification, and trustworthy diffs.
- **No network at build time.** Plugin installation (`dsx add`) touches the network; `dsx build` never does. Doc generation ([specs/doc-generation.md](../specs/doc-generation.md)) is the sole, explicitly-flagged exception.

## What is deliberately absent

- No runtime library shipped to user applications (see VISION non-goals; Diez post-mortem in [prior-art.md](../prior-art.md)).
- No component abstraction in v1 ([ADR-0003](../adr/0003-tokens-first.md)) — but the IR reserves the `component` token tier so v2 slots in without a breaking change.
- No plugin sandboxing in v1 — plugins are npm packages executing with full trust, like Babel/ESLint/Vite plugins. The trust model and its trade-offs are documented in [plugins.md](plugins.md#trust-model).
