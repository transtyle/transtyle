# Changelog

All notable changes to the Transtyle CLI/core are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows the scheme in [docs/architecture/versioning.md](docs/architecture/versioning.md) (the IR spec and plugin API are versioned separately).

Nothing is published to npm yet; entries under *Unreleased* describe what exists on `main`.

## [Unreleased]

### Added

- `@transtyle/core` — loader, normalizer, derivation engine, emitter, diagnostics; zero runtime dependencies.
- `@transtyle/ir` — IR spec v0 types and catalog.
- `@transtyle/cli` — `build` and `check` commands.
- Exporters: `@transtyle/exporter-shadcn` (both Tailwind eras, light/dark modes), `@transtyle/exporter-echarts` (per-mode themes, brand-derived categorical palette), `@transtyle/exporter-daisyui` (v5 era).
- Examples: `examples/acme` (minimal, 11 authored tokens) and `examples/cathode` (hostile adoption exercise).
- Documentation website (`website/`, Astro) with docs, roadmap ledger, and AI-agents page.
- Project meta: LICENSE (MIT), SECURITY.md, CODE_OF_CONDUCT.md, this changelog.
