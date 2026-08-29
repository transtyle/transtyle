# Changelog

All notable changes to the Transtyle CLI/core are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows the scheme in [docs/architecture/versioning.md](docs/architecture/versioning.md) (the IR spec and plugin API are versioned separately).

Nothing is published to npm yet; entries under _Unreleased_ describe what exists on `main`.

## [Unreleased]

### Changed

- `<role>.contrast` is now derived (Phase 0 exercise finding F20): the role's hue/chroma re-anchored at the text lightness per mode. The catalog had guaranteed the slot since v0, but no rule filled it — caught by the Bootstrap re-run when the engine had nothing where the exercise's hand maps had consumed `neutral.contrast`. No existing exporter consumes the slot, so emitted outputs are unchanged.
- `mix` semantics pinned **and the implementation brought into conformance** (F21): cartesian OKLab interpolation, alpha linear. The previous implementation lerped hue in polar OKLCH (behind an achromatic guard), which passes through unrelated hues at moderate mix ratios — an amber border tint on a blue-cast dark surface came out cyan. Emitted example outputs are byte-unchanged (the affected slots aren't consumed by shipped exporters yet); the fix matters for the upcoming Bootstrap exporter's `-border-subtle` values.
- `text-on-<role>.subtle` derivation is now the **on-brand walk** (Phase 0 exercise finding F19): start at `<role>.active`, step lightness away from the tinted background until WCAG AA clears, fall back to max contrast only when the ramp runs out. Light-mode output is unchanged for the examples; dark-mode subtle foregrounds become on-brand (e.g. Acme's `--accent-foreground` in dark is now a lightened brand blue instead of plain text color). The AA hard-rule warning (`TST2101`) now also fires for `subtle` pairings.

### Added

- `@transtyle/core` — loader, normalizer, derivation engine, emitter, diagnostics; zero runtime dependencies.
- `@transtyle/ir` — IR spec v0 types and catalog.
- `@transtyle/cli` — `build` and `check` commands.
- Exporters: `@transtyle/exporter-shadcn` (both Tailwind eras, light/dark modes), `@transtyle/exporter-echarts` (per-mode themes, brand-derived categorical palette), `@transtyle/exporter-daisyui` (v5 era).
- Examples: `examples/acme` (minimal, 11 authored tokens) and `examples/cathode` (hostile adoption exercise).
- Documentation website (`website/`, Astro) with docs, roadmap ledger, and AI-agents page.
- Website blog (`/blog/`, sources in `website/src/blog/`), opened by the release article "A compiler for design systems". Posts are listed in `llms.txt` and served as raw markdown at `/blog/<slug>.md`, and `check:docs` validates their frontmatter and internal links.
- `sitemap.xml` and `robots.txt`, both enumerated from the same sources the pages are built from (`nav.js`, the post glob). The raw-markdown routes, `llms.txt` and the OG cards are deliberately excluded from the sitemap as alternate representations of listed pages; `lastmod` is claimed only where the site actually knows it (a post's own date).
- Full-content RSS feed at `/blog/rss.xml` (hand-rolled, no feed dependency), discoverable from every page's `<link rel="alternate">`.
- Generated Open Graph cards, one per page (`/og/default.png`, `/og/docs-<slug>.png`, `/og/blog-<slug>.png`), rendered at build time by satori + resvg-wasm from the site's own dark palette (converted from OKLCH by `@transtyle/core`'s color module), plus the `og:*`/`twitter:*`/canonical metadata that points at them. Each post's card carries its own accent hue — derived from the slug, overridable with an `accentHue` frontmatter field, contrast-checked against the card background.- Project meta: LICENSE (MIT), SECURITY.md, CODE_OF_CONDUCT.md, this changelog.
