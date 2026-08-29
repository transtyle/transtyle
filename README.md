# Transtyle

> A design system compiler. Describe your design system once; compile it to every ecosystem.

**Status: walking skeleton.** The repository contains the complete product blueprint ([docs/](docs/)) plus a working implementation: the core pipeline and eight exporters (shadcn/ui, daisyUI, Apache ECharts, Bootstrap, Storybook, css-variables — the plugin-API reference implementation — Radix Colors/Themes, and PrimeNG), exercised end-to-end by four examples and their runnable demo projects — two invented ([Acme](examples/acme/), [Cathode](examples/cathode/)) and two real, independently-designed systems adopted via the binding-layer pattern ([GOV.UK](examples/govuk/), [Carbon](examples/carbon/)). The **component tier is live on two targets**: PrimeNG (severity grid + archetype helpers) and Bootstrap (all 657 component-scoped variables classified against a checked-in surface inventory — driven by `component.*` tokens with semantic defaults, chained through Bootstrap's own expressions, or honestly reported; both Sass and CSS-variable paths). See [ROADMAP.md](ROADMAP.md) for what's real vs. planned.

## What it is

Transtyle is a **compiler for design systems**. It takes a framework-agnostic description of a design system — tokens, semantics, modes — and produces native, ready-to-use theme artifacts for many target ecosystems: Bootstrap, shadcn/ui, Apache ECharts, Storybook, Tailwind, Material UI, and more.

The mental model is deliberately borrowed from Babel and LLVM:

```
importers (frontends)      intermediate representation       exporters (backends)
─────────────────────      ───────────────────────────       ────────────────────
DTCG token files      ┐                                  ┌→  Bootstrap (Sass + CSS vars)
Figma variables       ├──→   normalized, derived,     ───┼→  shadcn/ui (globals.css)
Tailwind config       ┘      validated token graph       ├→  Apache ECharts (theme JSON)
                                                         └→  Storybook (manager + preview)
```

One source of truth in the middle; pluggable frontends and backends on either side. This is what makes ecosystem-to-ecosystem translation (Bootstrap → shadcn/ui) a composition of existing parts rather than a special feature.

## Core principles

1. **DTCG superset, not a proprietary format.** The token source format is valid [W3C Design Tokens (DTCG)](https://design-tokens.github.io/community-group/format/) plus namespaced extensions. Anything that speaks DTCG (Style Dictionary, Tokens Studio, Figma) interoperates for free. See [ADR-0002](docs/adr/0002-dtcg-superset-ir.md).
2. **Deterministic, explainable derivation.** Missing tokens (e.g. `accent` when only `primary` is defined) are filled by declarative, inspectable rules — never by hidden magic. Every generated value carries provenance you can query with `transtyle explain`. See [docs/architecture/derivation.md](docs/architecture/derivation.md).
3. **Honest about lossiness.** Every build emits a coverage report: what mapped natively, what was derived, what was approximated, what the target cannot express. Trust is the product. See [docs/specs/validation-and-coverage.md](docs/specs/validation-and-coverage.md).
4. **Exporters are plugins.** The core knows nothing about Bootstrap. Official and third-party exporters use the same public plugin API, versioned independently of the CLI. See [docs/architecture/plugins.md](docs/architecture/plugins.md).
5. **Generated output is native and disposable.** Outputs are idiomatic files for the target (a `_variables.scss` a Bootstrap dev would recognize), never a runtime dependency on us. Regeneration is byte-deterministic.

## Try it now

```bash
npm install                 # link workspaces (compiler packages have zero external dependencies)
cd examples/acme
npx transtyle build         # shadcn (both Tailwind eras) + daisyUI + Apache ECharts + Bootstrap + Storybook themes
npx transtyle check         # pipeline without emit: validation + contrast + coverage
```

The generated `globals.transtyle.css` (light + dark, `@theme inline`) drops into any Tailwind v4 shadcn project, `_variables.transtyle.scss`/`_maps.transtyle.scss` import around Bootstrap's own Sass build, and `theme.*-{light,dark}.json` registers straight into Apache ECharts — see each generated `usage.md`. Acme's 40 authored tokens — nine of them actual design decisions — produce 271 resolved slots per mode and the full variable set of every target; everything unauthored is derived deterministically with provenance recorded in `report.json`.

To _see_ the themes on real framework components, each example ships npm-runnable demo projects (`examples/<example>/demo/<target>/`, one Vite/Storybook project per target, consuming only the compiled `dist/`):

```bash
npm run dev -w acme-demo-bootstrap     # Nimbus Console in real Bootstrap (Sass path), port 4101
npm run dev -w acme-demo-shadcn        # the same page in real shadcn/ui components, port 4103
npm run dev -w cathode-demo-storybook  # a phosphor-green Storybook, port 6201
```

A second, deliberately hostile example lives in [examples/cathode/](examples/cathode/): a dark-native CRT terminal DS with its own vocabulary (`crt.ink`, `crt.tube`, `crt.meltdown`) bound to the semantic catalog through one-line aliases — the pattern for compiling _uncommon_ design systems.

Two more examples adopt **real, published design systems** nobody on this project designed — [examples/govuk/](examples/govuk/) (the UK government's [GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/)) and [examples/carbon/](examples/carbon/) (IBM's [Carbon Design System](https://carbondesignsystem.com/elements/color/tokens/)) — the same binding-layer pattern as Cathode, this time against systems with real published token values and real accessibility/branding constraints. See each example's README and [`docs/findings/`](docs/findings/) for what mapped cleanly and what needed a judgment call.

The full design-target CLI is specced in [docs/specs/cli.md](docs/specs/cli.md); `build`, `check`, `explain`, `init`, `add`, and `diff` are implemented today (`npx transtyle init` scaffolds a project, `npx transtyle explain <slot>` prints its provenance chain, `npx transtyle diff` reports what a token change does to every compiled theme) — `import`, `preview`, version pinning remain specced.

## Documentation

**User documentation lives on the website** (`website/` — Astro; `npm run site:dev` locally, deployable static output via `npm run site:build`): getting started, concepts, configuration reference, CLI, exporter guides, example walkthroughs, diagnostics, and a dedicated guide for [operating Transtyle with AI agents](website/src/docs/ai-agents.md). The site also serves `llms.txt`, `llms-full.txt`, and every page as raw markdown.

The site also has a **blog** (`website/src/blog/`, one markdown file per post, published at `/blog/<filename>/`, with a full-content RSS feed at `/blog/rss.xml`). The first post — [A compiler for design systems](website/src/blog/a-compiler-for-design-systems.md) — is the release article: what the project is, why it is (and isn't) new against the token-tooling landscape, how the pipeline works, and who it's for. `npm run check:docs` enforces post frontmatter and link resolution the same way it does for docs pages.

Engineering documentation (architecture, specs, ADRs) lives in [docs/](docs/) — see the map below. The sync rule between code, specs, website, README, and examples is defined in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation map

| Area                | Documents                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why / what          | [VISION.md](VISION.md), [docs/prior-art.md](docs/prior-art.md), [docs/naming.md](docs/naming.md)                                                                                                                                                                                                                                                                                              |
| Architecture        | [overview](docs/architecture/overview.md), [pipeline](docs/architecture/pipeline.md), [IR](docs/architecture/ir.md), [derivation](docs/architecture/derivation.md), [plugins](docs/architecture/plugins.md), [versioning](docs/architecture/versioning.md)                                                                                                                                    |
| Specifications      | [configuration](docs/specs/configuration.md), [CLI](docs/specs/cli.md), [validation & coverage](docs/specs/validation-and-coverage.md), [doc generation](docs/specs/doc-generation.md), [component layer (v2)](docs/specs/component-layer.md)                                                                                                                                                 |
| Reference exporters | [Bootstrap](docs/specs/exporters/bootstrap.md), [shadcn/ui](docs/specs/exporters/shadcn.md), [ECharts](docs/specs/exporters/echarts.md), [Storybook](docs/specs/exporters/storybook.md), [daisyUI](docs/specs/exporters/daisyui.md), [css-variables](docs/specs/exporters/css-variables.md), [Radix Colors/Themes](docs/specs/exporters/radix.md), [PrimeNG](docs/specs/exporters/primeng.md) |
| Decisions           | [docs/adr/](docs/adr/)                                                                                                                                                                                                                                                                                                                                                                        |
| Plan                | [ROADMAP.md](ROADMAP.md)                                                                                                                                                                                                                                                                                                                                                                      |

## Naming

**Transtyle** (transpile × style): the product is a source-to-source compiler for design systems, and the name says so. npm org (`@transtyle`) and GitHub org are registered. Selection history and rejected candidates live in [docs/naming.md](docs/naming.md).

## License

[MIT](LICENSE).
