# Roadmap

Phases gate on outcomes, not dates. Each phase has an explicit exit criterion; we do not start the next phase until it is met. Version numbers below refer to the CLI/core; the plugin API and IR spec are versioned separately (see [docs/architecture/versioning.md](docs/architecture/versioning.md)).

## Phase 0 — Foundation freeze (pre-code)

- ~~Finalize name~~ **Done: Transtyle** ([docs/naming.md](docs/naming.md)) — npm + GitHub orgs registered 2026-07-18. Remaining: domains, trademark search, repo rename.
- Freeze IR spec v0 ([docs/architecture/ir.md](docs/architecture/ir.md)) and plugin API v0 ([docs/architecture/plugins.md](docs/architecture/plugins.md)) as written specs.
- Validate the IR on paper: hand-translate one real design system (e.g. an open corporate DS) into the IR and hand-map it to all four reference targets. Every gap found here is 10× cheaper than after code exists.
  - **Round 1 (shadcn) done 2026-07-18** — 3 IR/rule-pack amendments accepted (F1–F3); see [docs/exercises/phase0-shadcn.md](docs/exercises/phase0-shadcn.md). Fixture DS lives in [examples/acme/](examples/acme/).
  - **Round 2 (Bootstrap) done 2026-07-19** — F1's generality confirmed (`text-on-<role>.subtle` ≡ `-text-emphasis`, the round's prediction); zero IR-catalog changes; 1 rule-pack amendment accepted (F8: radius-scale derivation); see [docs/exercises/phase0-bootstrap.md](docs/exercises/phase0-bootstrap.md). Counter reset by F8. (ECharts was validated in code — its exporter shipped without IR changes.)
  - **Round 3 (Storybook) done 2026-07-19** — zero amendments, the first clean attempt (counter: 1 of 2); F8/F3/F1 all found second consumers; expanded-mode-matrix and manifest-only composition validated; see [docs/exercises/phase0-storybook.md](docs/exercises/phase0-storybook.md).
  - **Round 4 (shadcn re-run) done 2026-07-19** — paper probe clean, but diffing the hand expectation against the *real compiler output* exposed F19: `contrast-pick(subtle)` had three conflicting definitions across spec, property-test, and code. Amendment ratified in spec and code together (the "on-brand walk"; light-mode output byte-identical, dark-mode subtle foregrounds now on-brand); see [docs/exercises/phase0-shadcn-rerun.md](docs/exercises/phase0-shadcn-rerun.md). **Counter reset to 0**, and the protocol upgraded: an "attempt" now requires both a clean paper mapping *and* a clean diff against compiler output where an exporter exists.
  - **Round 5 (shadcn, post-F19 pack) done 2026-07-19** — **clean on both probes** (counter: 1 of 2). All 16 historical deltas classified as hand-run artifacts; the ratified walk verified by an independent spec-text re-implementation; round 2's Bootstrap hand maps retroactively confirmed (they implicitly assumed the walk). See [docs/exercises/phase0-shadcn-rerun2.md](docs/exercises/phase0-shadcn-rerun2.md).
  - **Round 6 (Bootstrap re-run) done 2026-07-19** — probe (b) against the engine found two amendments: F20 (`<role>.contrast` was catalog-guaranteed but underivable — round 2 had consumed it with two inconsistent hand values) and F21 (`mix` semantics unpinned; the implementation polar-lerped hue, turning amber border tints cyan at moderate ratios — pinned to cartesian OKLab in spec and code; round 5's "cartesian" observation carries an erratum). Shipped outputs byte-unchanged; the `expected/bootstrap/` fixture regenerated engine-exact. **Counter reset to 0.** See [docs/exercises/phase0-bootstrap-rerun.md](docs/exercises/phase0-bootstrap-rerun.md).
  - **Round 7 (Bootstrap, ratified pack) done 2026-07-19** — **clean on both probes** (counter: 1 of 2). Probe (b) mechanized: every hex in the fixture parsed and exact-matched against a fresh engine run; scope limitation recorded (non-color rules remain unimplemented, unverifiable by this probe until Phase 1). See [docs/exercises/phase0-bootstrap-rerun2.md](docs/exercises/phase0-bootstrap-rerun2.md).
  - **Round 8 (shadcn, ratified pack) done 2026-07-19 — clean; rounds 7+8 are two consecutive clean attempts.** Also swept the Storybook fixture engine-exact (one more hand-run slot collapse found and fixed, no amendment). Exercise ledger closed at F1–F21 over 8 rounds. See [docs/exercises/phase0-shadcn-round8.md](docs/exercises/phase0-shadcn-round8.md).

**Exit:** the paper exercise produces acceptable Bootstrap/shadcn/ECharts/Storybook themes with no IR changes needed for two consecutive attempts. — **Met 2026-07-19** (rounds 7 and 8, under the upgraded two-probe protocol; scope limit recorded: non-color rules are specced but unimplemented and get their verification in Phase 1's ground-truth tests). Remaining: the formal freeze declaration of IR spec v0 + plugin API v0, and the naming tail (domains, trademark search, repo rename) — Phase 1 implementation has proceeded meanwhile (all reference exporters shipped 2026-07-20 without IR-catalog changes, which is itself evidence the freeze is ready to declare).

## Phase 1 — Core compiler + reference exporters (v0.1–v0.x)

Scope: **foundations only** — colors, typography, spacing, radius, shadows, borders, motion, z-index/elevation. No component abstraction ([ADR-0003](docs/adr/0003-tokens-first.md)).

### Done

- ✅ `@transtyle/core`: loader, normalizer, derivation engine — standard@1 now implements the full [role grid](docs/architecture/ir.md#color-the-role-grid) (prominence × state per color role), the elevation ladder + shadows, the content hierarchy, and the foundations scales (space/size/border-width/breakpoint/z/type/motion), landed 2026-07-20 as the catalog revision ([proposal 0001](docs/proposals/0001-universal-token-ir.md), [ADR-0010](docs/adr/0010-pre-release-breaking-changes.md)) — resolver host, emitter, diagnostics, coverage report (`report.json`; [docs/specs/validation-and-coverage.md](docs/specs/validation-and-coverage.md)).
- ✅ `@transtyle/cli`: `build`, `check`, `--cwd`, target instances.
- ✅ **All four reference exporters** — **shadcn/ui** (both Tailwind eras), **ECharts** (per-mode themes, derived 8-color palette), **Bootstrap** (2026-07-20: Sass path `_variables`+`_maps` *and* CSS-variable path; the IR stress test), **Storybook** (2026-07-20: chrome ThemeVars in the DS-native mode + sibling preview composition via the `ctx.siblings` manifest) — plus **daisyUI** (B3 pull-forward). Bootstrap and Storybook were accepted value-exact against their Phase 0 fixtures, closing the fixtures' purpose.
- ✅ **Demo projects** (2026-07-20, [docs/specs/demo-app.md](docs/specs/demo-app.md)): ten npm projects (5 targets × 2 examples) rendering the themes on each target's *real* toolchain and components, consuming only `dist/`. This is the standing harness for the exit criterion's manual review.
- ✅ DTCG files are valid input end-to-end (both examples are pure DTCG + config).

### Remaining — the catalog revision sequence

Direction set 2026-07-20: [proposal 0001](docs/proposals/0001-universal-token-ir.md) (the role grid as universal IR) is **accepted**, and per [ADR-0010](docs/adr/0010-pre-release-breaking-changes.md) it lands as a **clean break, not a version bump** — Transtyle is unreleased and every schema is still `v0`, so old catalog names are removed, not aliased, and no version number moves; the freeze re-arms at first npm publication. Every task below is fully specified for any implementer (including lower-capability AI models) in **[docs/plan/catalog-revision.md](docs/plan/catalog-revision.md)** — exact slot names, formulas, file lists, acceptance commands. Execute strictly in order; one task = one pushed commit series; the CONTRIBUTING sync rule and `npm run check:sync` apply to every one.

- [x] **T1** — Rewrite the IR spec to the revised catalog (grid cells, elevation ladder, content hierarchy, scales, reserved modes; ir.md + derivation.md + website mirror).
- [x] **T2** — Engine: the revised rule pack, still `standard@1` (grid derivation with pinned formulas, elevation/shadow/z ladders, type & space scales, motion; `scripts/check-grid.mjs` proves promoted conventions reproduce the Bootstrap fixture values byte-for-byte).
- [x] **T3** — Migrate all five exporters, examples, demos to the revised names; dead-vocabulary guard added to `check-sync` (no old slot name survives anywhere). Landed together with T2 (see worklog: they can't be verified independently — the engine and the token files/exporters that speak its vocabulary have to change in the same buildable commit).
- [x] **T4** — css-variables exporter: the grid-complete conformance dump (+ demo projects, all five surfaces).
- [x] **T5** — Permanent ground-truth scripts (`check-fixtures`, `check-determinism`, `check:all`) + GitHub Actions CI.
- [x] **T6** — CLI `explain` / `init` / `add` (+ `check-cli` golden tests).
- [ ] **T7** — Role archetypes: custom roles derive the full grid and export to open-role targets (Cathode's `crt-amber` as showcase).
- [ ] **T8** — Multi-dimension modes + reserved dimensions (`density` worked example on Acme).
- [ ] **T9** — **Radix Themes exporter** — the grid's designated acceptance test (its 12 steps consume every grid column); clean attempt №1 toward re-freezing the catalog.
- [ ] **T10** — DTCG validation UX (new stable diagnostic codes + `check --json`).
- [ ] **T11** — The real-DS run: adopt an external open design system via the binding-layer playbook; practitioner review; Phase 1 exit.

**Exit:** a real design system compiles to all reference targets; outputs pass manual review by a practitioner of each target framework; deterministic builds verified in CI. — *Progress 2026-07-20: both example DSs compile to all five shipped targets and render in the demo projects; the sequence above carries the rest.*

## Phase 2 — Trust and workflow (v1.0)

- `transtyle diff`: semantic diff between two DS versions, per-target impact summary.
- `transtyle preview`: our own themed preview site (see [ADR-0007](docs/adr/0007-doc-generation-scope.md) for why this precedes upstream-doc rebuilding).
- Watch mode, CI recipes, JSON diagnostics output for tooling.
- Plugin conformance test kit + third-party exporter tutorial; plugin API declared v1 (semver-stable).
- Importers beyond DTCG: Tailwind config, Figma variables export.

**Exit criterion for v1.0:** a third party has shipped a working exporter without touching core, using only public docs.

## Phase 3 — Ecosystem translation (v1.x)

- Importers: Bootstrap (Sass variables → IR), shadcn (globals.css → IR), MUI theme object → IR.
- Round-trip fidelity reporting (import coverage, mirroring export coverage).
- `transtyle doc <target>` experimental upstream-doc theming for targets whose exporters declare the capability.
- Exporter registry metadata (`transtyle add` resolves community exporters).

## Phase 4 — Component layer (v2.0)

Specced in [docs/specs/component-layer.md](docs/specs/component-layer.md); deliberately deferred ([ADR-0003](docs/adr/0003-tokens-first.md)). Begins only after ≥3 community exporters exist and the token IR has survived a year of real use.

## Backlog

Captured-but-unscheduled ideas live in [docs/backlog.md](docs/backlog.md) — currently: implemented-only editorial policy (adopted), starter theme-kit template (its demo-app half shipped 2026-07-20 as the real npm demo projects; the `create-transtyle` packaging stays gated on npm publication), target priority order (daisyUI, Bootstrap, and Storybook now shipped; **Radix Themes** is next on the B3 list), the "adopt an existing design system" guide (written — it becomes Phase 1's "real DS" run), and "the Transtyle language" reference page (written).

## Standing tracks (all phases)

- **Spec hygiene:** track DTCG evolution; migrate extensions to spec features as they land.
- **Target version tracking:** exporters update compat ranges as frameworks release ([docs/architecture/versioning.md](docs/architecture/versioning.md)).
- **Accessibility:** contrast checking ships in Phase 1 `check`, not as a later add-on.

## Explicitly cut from all current phases

Visual token editor; hosted/SaaS anything; AI-assisted theme generation; native mobile targets (iOS/Android) — plausible later, but each would dilute the web-framework wedge that establishes the project.
