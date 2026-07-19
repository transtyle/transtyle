# Changelog

All notable changes to the Transtyle CLI/core are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows the scheme in [docs/architecture/versioning.md](docs/architecture/versioning.md) (the IR spec and plugin API are versioned separately).

Nothing is published to npm yet; entries under *Unreleased* describe what exists on `main`.

## [Unreleased]

### Changed

- `text-on-<role>.subtle` derivation is now the **on-brand walk** (Phase 0 exercise finding F19): start at `<role>.active`, step lightness away from the tinted background until WCAG AA clears, fall back to max contrast only when the ramp runs out. Light-mode output is unchanged for the examples; dark-mode subtle foregrounds become on-brand (e.g. Acme's `--accent-foreground` in dark is now a lightened brand blue instead of plain text color). The AA hard-rule warning (`TST2101`) now also fires for `subtle` pairings.

### Added

- `@transtyle/core` — loader, normalizer, derivation engine, emitter, diagnostics; zero runtime dependencies.
- `@transtyle/ir` — IR spec v0 types and catalog.
- `@transtyle/cli` — `build` and `check` commands.
- Exporters: `@transtyle/exporter-shadcn` (both Tailwind eras, light/dark modes), `@transtyle/exporter-echarts` (per-mode themes, brand-derived categorical palette), `@transtyle/exporter-daisyui` (v5 era).
- Examples: `examples/acme` (minimal, 11 authored tokens) and `examples/cathode` (hostile adoption exercise).
- Documentation website (`website/`, Astro) with docs, roadmap ledger, and AI-agents page.
- Project meta: LICENSE (MIT), SECURITY.md, CODE_OF_CONDUCT.md, this changelog.
