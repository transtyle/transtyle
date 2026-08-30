# Contributing

## The sync rule (definition of done)

Transtyle treats documentation drift as a defect. **A feature is not done until all five surfaces agree:**

1. **The code** — `packages/*`, with the change actually working (`npm run example:check` passes, builds are deterministic).
2. **The specs** — `docs/` (architecture, specs, ADRs). If the change alters a design decision, that's a new ADR or an amendment to the affected spec, not a silent divergence. Findings made during implementation flow _back_ into the specs, credited.
3. **The website** — `website/src/docs/`. User-facing behavior changes update the relevant pages, including `roadmap.md`'s implemented/specced ledger and, when machine-visible surfaces change (codes, report schema, CLI), `ai-agents.md`.
4. **The README** — the repo front door must never overpromise or underreport what works.
5. **The examples** — `examples/acme` (minimal), `examples/cathode` (hostile), and the two real-DS adoptions `examples/govuk` and `examples/carbon` must build cleanly and exercise the new behavior where it applies; their READMEs updated.

Review checklist for any PR: does `npx transtyle build` still produce byte-identical output on double-build? Do all internal doc links resolve? Does the roadmap ledger still tell the truth?

**Implementation plans:** substantial work is pre-specified in [docs/plan/](docs/plan/) (currently [catalog-revision.md](docs/plan/catalog-revision.md)) with exact files, values, and acceptance commands per task. Implementers — human or AI — follow the plan; do not improvise where it specifies, and record any necessary deviation in the task's worklog entry with a reason. The ROADMAP's checkbox ledger tracks task completion.

**The rule is mechanized where it can be:** `npm run check:sync` ([scripts/check-sync.mjs](scripts/check-sync.mjs)) walks the CLI's exporter registry and fails if any shipped exporter is missing from any surface — package, spec, website page + nav + roadmap table, README, example configs, demo projects — or is still called "specced" in website prose. It runs automatically before `site:build`. Run it before declaring any feature done, and **extend it whenever a new class of drift is discovered** (it exists because a shipped exporter once had no website page).

`npm run check:sync` also runs the **docs-precision guard** (`npm run check:docs`, [scripts/check-docs.mjs](scripts/check-docs.mjs)): every website docs page must be reachable from `nav.js` (and vice versa), every internal link and `#anchor` must resolve to a real page and heading (anchor ids verified GitHub-slugger-style, as Astro generates them), the CLI commands documented as implemented must exactly match the CLI's `COMMANDS`, and every diagnostic code emitted in package sources must appear in the diagnostics page (and every code the page tables must exist in source). The website is a promise-making surface; this guard re-checks those promises mechanically on every run (it exists because it found genuinely broken anchors and could have caught a stale command list).

A third guard covers what neither of those can see: **`npm run check:doc-numbers`** ([scripts/check-doc-numbers.mjs](scripts/check-doc-numbers.mjs)) re-derives every _number_ the docs copy out of a build. A coverage transcript (`shadcn 42% native · 53% derived · …`) in any docs page, blog post, or the homepage is recomputed by compiling that example in-process with the CLI's own rounding, and every `.covmatrix` diagram's segment widths must match the compiled coverage for the example its `data-example` attribute names — a matrix without that attribute fails, because an unlabeled diagram is a number nobody can re-derive. It exists because a page whose links all resolved was quoting a coverage split that had been wrong for months: numbers are promises too, and structure checks can't see them. Prose figures have their own mechanism: declare them with a `<!-- measured: <metric> = <value> -->` comment on the line above (`acme.slots`, `acme.authored`, `bootstrap.surface.component`, `demos`, … — the list is in the script's `measure()`). The checker recomputes the metric from the repo _and_ requires the number to still appear in the block below the marker, so the marker can't drift off its sentence and the sentence can't be edited out from under its marker. Adding a metric is the cheap way to put a new number under guard; a figure with no metric behind it stays a human duty — measure it against a fresh build rather than copying the previous sentence. **Every checker compiles what it needs and none reads `examples/*/dist/`**, which is gitignored: a check that reads build output either finds nothing on a fresh clone or grades a build that predates the change under test. This one learned that on its first CI run. That rule and the rest of the conventions for writing a checker — verify the failure, extend rather than multiply, fail with the fix — live in [scripts/README.md](scripts/README.md), which also indexes what each of the sixteen guards actually guards.

**`npm run check:all`** chains every ground-truth check: `check:sync` (the rule above) + `check:doc-numbers` + `check:format` (Prettier, `.prettierrc.json` — every `.md`/`.mdx` file; `npm run format:md` fixes drift locally, `.prettierignore` excludes build output) + `check:color` ([scripts/check-color.mjs](scripts/check-color.mjs), every accepted colour syntax parses to reference values, hex round-trips losslessly, contrast and mix endpoints correct) + `check:plugins` ([scripts/check-plugins.mjs](scripts/check-plugins.mjs), every official exporter passes `@transtyle/plugin-kit`'s conformance suite — the executable plugin contract) + `check:schemas` ([scripts/check-schemas.mjs](scripts/check-schemas.mjs), the published JSON schemas match their source-of-truth objects, every example config validates, known-bad configs are rejected, and every emitted report conforms — it builds the examples itself, so it never grades a stale one) + `check:grid` ([scripts/check-grid.mjs](scripts/check-grid.mjs), catalog completeness and frozen fixture values) + `check:fixtures` ([scripts/check-fixtures.mjs](scripts/check-fixtures.mjs), a fresh build diffed key-by-key against the Phase 0 acceptance fixtures) + `check:determinism` ([scripts/check-determinism.mjs](scripts/check-determinism.mjs), two builds byte-compared). Editing a config/report schema means regenerating the published files: `npm run gen:schemas` (the source of truth is `packages/core/src/schema/`). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs all of it plus a site build and a matrix build of every demo project on every push/PR to `main`.

**Implemented-only editorial policy:** user-facing docs (website, README) may name an unimplemented capability only inside an explicit status construct — the roadmap ledger, a "specced" label, or a "not yet implemented" sentence — never in feature prose. Engineering specs in `docs/` are exempt; they are the plan and say so.

## Principles that constrain changes

- **Compiler packages stay zero-dependency.** The website workspace may have dependencies; `packages/*` may not. A PR adding a dependency to core needs an ADR-level justification.
- **Determinism is non-negotiable.** No timestamps, randomness, or network in the build path.
- **Authored always wins.** No derivation rule may overwrite an authored token.
- **Diagnostics have stable codes.** New codes are appended, never renumbered; every code is documented in `website/src/docs/diagnostics.md`.
- **Config is data.** No executable config.
- **The catalog is a meta-language, not a translation of any one target.** New semantic-tier (or component-tier) vocabulary must be validated against multiple independent ecosystems before being added — never derived from a single library's own naming or grouping shape (`docs/proposals/0001-universal-token-ir.md`'s 14-ecosystem study is the model to match, not a one-time exception). Concretely: (1) exporters translate by _meaning_, not name — the same catalog token may legitimately feed several differently-shaped or differently-named places in one target's own structure; (2) new shared derivation logic starts **exporter-private** (a helper inside that one exporter, reading existing catalog cells) and is promoted into the shared catalog only once a **second, independent** exporter needs the identical thing — the path Bootstrap's border-subtle mix took before it was promoted into an engine-owned grid cell ([exercise F10](docs/exercises/phase0-bootstrap.md)), not a one-off.

## Working locally

Changes to a published package need a changeset (`npm run changeset`) in the same PR — see [RELEASING.md](RELEASING.md), which also covers how alpha and stable releases are cut and why the difference matters.

```bash
npm install                    # links workspaces; installs website deps
npm run example:shadcn         # compile the Acme example
npm run example:check          # validate without emitting (Acme)
npm run example:check:cathode  # same, for Cathode / GOV.UK / Carbon
npm run example:check:govuk
npm run example:check:carbon
npm run example:build          # build all four examples
npm run example:build:govuk    # or just one (also: :acme, :cathode, :carbon)
npm run site:dev               # docs site dev server
npm run site:build             # build the static site
```
