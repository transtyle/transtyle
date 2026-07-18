---
title: "Status & roadmap"
description: "What works today, what is specced, and in which order it lands."
order: 12
---

# Status & roadmap

Transtyle's design phase produced a complete blueprint before any code; the walking skeleton implements the core slice end-to-end. This page is the honest ledger of which is which.

## Implemented today (v0.1 walking skeleton)

| Area | Status |
|---|---|
| Compiler pipeline (load → normalize → derive → resolve → emit → report) | ✅ end-to-end, byte-deterministic |
| DTCG-superset token loading, aliases, cycle detection, tiers | ✅ |
| Modes: one dimension, inline `$extensions` **and** mode-scoped layer files | ✅ equivalent by construction |
| Derivation: standard@1 color subset (roles, states, subtles, on-colors, surfaces, ring, chart palette) | ✅ with provenance |
| OKLCH color engine, WCAG 2.1 contrast checks | ✅ zero-dep, in-house |
| shadcn/ui exporter, tailwind-v4 + tailwind-v3 era profiles | ✅ |
| Apache ECharts exporter: per-mode theme JSON + self-registering scripts, 8-color derived palette | ✅ |
| daisyUI exporter (v5 era): light+dark theme blocks, brand-direct role mapping | ✅ |
| Target instances (one exporter, many configs) | ✅ |
| Coverage report (`report.json`) + diagnostics with stable codes | ✅ |
| CLI: `build`, `check`, `--cwd` | ✅ |
| Examples: Acme (minimal), Cathode (hostile) | ✅ |

## Specced, not yet implemented

Design-complete in the repo's `docs/` (architecture specs + ADRs), waiting their turn:

| Feature | Where the design lives |
|---|---|
| Exporters: Bootstrap, Storybook, css-variables | `docs/specs/exporters/` |
| CLI: `init`, `add`, `explain`, `diff`, `import`, `preview`, `migrate` | `docs/specs/cli.md` |
| Full semantic catalog: spacing, shadows/elevation, motion, z-index, typography scales | `docs/architecture/ir.md` |
| Derivation `overrides`, user rule expressions, `autoDark` audit flow | `docs/architecture/derivation.md` |
| Importers (Figma variables, Tailwind config, Bootstrap Sass) | ADR-0008 |
| Plugin packaging, conformance kit, third-party exporters | `docs/architecture/plugins.md` |
| Lockfile (`transtyle.lock`), `--frozen` CI mode | `docs/architecture/versioning.md` |
| Multi-dimension modes (density, brand variants) | `docs/architecture/ir.md` |
| Component theming layer (v2) | `docs/specs/component-layer.md`, ADR-0003 |

## Sequencing (from the project ROADMAP)

1. **Phase 0 — validate the IR** (in progress): shadcn round done on paper (three IR amendments accepted); the ECharts round was validated directly in code — the exporter shipped without requiring IR changes, a good sign for the catalog. Remaining: Bootstrap (the hardest constraint set), Storybook (meta-target), then a clean shadcn re-run.
2. **Phase 1 — foundations compiler + four reference exporters**, npm publication, `init`.
3. **Phase 2 — trust & workflow**: `explain`, `diff`, preview site, plugin conformance kit, importers beyond DTCG. Exit criterion for v1.0: a third party ships a working exporter using only public docs.
4. **Phase 3 — ecosystem translation**: importers from Bootstrap/MUI/shadcn; round-trip fidelity reporting.
5. **Phase 4 — component theming layer (v2)**, only after the token IR has survived a year of real use.

## What is deliberately never coming

No runtime shipped to your app. No component implementation generation. No visual editor. No AI inside the compiler (deterministic rules only — AI belongs *outside*, writing config; see [AI agents](/docs/ai-agents/)). No pixel-perfect-equivalence claims — the coverage report exists precisely because translation is lossy.
