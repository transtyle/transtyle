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

**Exit:** the paper exercise produces acceptable Bootstrap/shadcn/ECharts/Storybook themes with no IR changes needed for two consecutive attempts. — **Met 2026-07-19** (rounds 7 and 8, under the upgraded two-probe protocol; scope limit recorded: non-color rules are specced but unimplemented and get their verification in Phase 1's ground-truth tests). Remaining before Phase 1 fully opens: the formal freeze declaration of IR spec v0 + plugin API v0, and the naming tail (domains, trademark search, repo rename).

## Phase 1 — Core compiler + reference exporters (v0.1–v0.x)

Scope: **foundations only** — colors, typography, spacing, radius, shadows, borders, motion, z-index/elevation. No component abstraction ([ADR-0003](docs/adr/0003-tokens-first.md)).

- `@transtyle/core`: loader, normalizer, derivation engine, resolver host, emitter, diagnostics.
- `@transtyle/cli`: `init`, `build`, `check`, `explain`, `add`.
- A trivial built-in **css-variables exporter** as the executable specification of the plugin API (simplest possible backend; also the conformance fixture for plugin testing).
- Reference exporters, in order: **Bootstrap** (hardest constraint set: Sass), **shadcn/ui** (modes — ✅ shipped in the skeleton, both Tailwind eras), **ECharts** (non-CSS output, palette derivation — ✅ shipped in the skeleton), **Storybook** (docs integration).
- Coverage report and `check` diagnostics ([docs/specs/validation-and-coverage.md](docs/specs/validation-and-coverage.md)).
- DTCG import (a DTCG file *is* valid input, so this is mostly validation UX).

**Exit:** a real design system compiles to all four targets; outputs pass manual review by a practitioner of each target framework; deterministic builds verified in CI.

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

Captured-but-unscheduled ideas live in [docs/backlog.md](docs/backlog.md) — currently: implemented-only editorial policy (adopted), starter theme-kit template with a shared demo app, target priority order (DaisyUI proposed next), the "adopt an existing design system" guide, and "the Transtyle language" reference page.

## Standing tracks (all phases)

- **Spec hygiene:** track DTCG evolution; migrate extensions to spec features as they land.
- **Target version tracking:** exporters update compat ranges as frameworks release ([docs/architecture/versioning.md](docs/architecture/versioning.md)).
- **Accessibility:** contrast checking ships in Phase 1 `check`, not as a later add-on.

## Explicitly cut from all current phases

Visual token editor; hosted/SaaS anything; AI-assisted theme generation; native mobile targets (iOS/Android) — plausible later, but each would dilute the web-framework wedge that establishes the project.
