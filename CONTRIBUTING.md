# Contributing

## The sync rule (definition of done)

Transtyle treats documentation drift as a defect. **A feature is not done until all five surfaces agree:**

1. **The code** — `packages/*`, with the change actually working (`npm run example:check` passes, builds are deterministic).
2. **The specs** — `docs/` (architecture, specs, ADRs). If the change alters a design decision, that's a new ADR or an amendment to the affected spec, not a silent divergence. Findings made during implementation flow *back* into the specs, credited.
3. **The website** — `website/src/docs/`. User-facing behavior changes update the relevant pages, including `roadmap.md`'s implemented/specced ledger and, when machine-visible surfaces change (codes, report schema, CLI), `ai-agents.md`.
4. **The README** — the repo front door must never overpromise or underreport what works.
5. **The examples** — `examples/acme` (minimal), `examples/cathode` (hostile), and the two real-DS adoptions `examples/govuk` and `examples/carbon` must build cleanly and exercise the new behavior where it applies; their READMEs updated.

Review checklist for any PR: does `npx transtyle build` still produce byte-identical output on double-build? Do all internal doc links resolve? Does the roadmap ledger still tell the truth?

**Implementation plans:** substantial work is pre-specified in [docs/plan/](docs/plan/) (currently [catalog-revision.md](docs/plan/catalog-revision.md)) with exact files, values, and acceptance commands per task. Implementers — human or AI — follow the plan; do not improvise where it specifies, and record any necessary deviation in the task's worklog entry with a reason. The ROADMAP's checkbox ledger tracks task completion.

**The rule is mechanized where it can be:** `npm run check:sync` ([scripts/check-sync.mjs](scripts/check-sync.mjs)) walks the CLI's exporter registry and fails if any shipped exporter is missing from any surface — package, spec, website page + nav + roadmap table, README, example configs, demo projects — or is still called "specced" in website prose. It runs automatically before `site:build`. Run it before declaring any feature done, and **extend it whenever a new class of drift is discovered** (it exists because a shipped exporter once had no website page).

**`npm run check:all`** chains every ground-truth check: `check:sync` (the rule above) + `check:grid` ([scripts/check-grid.mjs](scripts/check-grid.mjs), catalog completeness and frozen fixture values) + `check:fixtures` ([scripts/check-fixtures.mjs](scripts/check-fixtures.mjs), a fresh build diffed key-by-key against the Phase 0 acceptance fixtures) + `check:determinism` ([scripts/check-determinism.mjs](scripts/check-determinism.mjs), two builds byte-compared). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs all of it plus a site build and a matrix build of every demo project on every push/PR to `main`.

**Implemented-only editorial policy:** user-facing docs (website, README) may name an unimplemented capability only inside an explicit status construct — the roadmap ledger, a "specced" label, or a "not yet implemented" sentence — never in feature prose. Engineering specs in `docs/` are exempt; they are the plan and say so.

## Principles that constrain changes

- **Compiler packages stay zero-dependency.** The website workspace may have dependencies; `packages/*` may not. A PR adding a dependency to core needs an ADR-level justification.
- **Determinism is non-negotiable.** No timestamps, randomness, or network in the build path.
- **Authored always wins.** No derivation rule may overwrite an authored token.
- **Diagnostics have stable codes.** New codes are appended, never renumbered; every code is documented in `website/src/docs/diagnostics.md`.
- **Config is data.** No executable config.

## Working locally

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
