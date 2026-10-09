# Versioning and compatibility model

> **Status (re-verified 2026-10-09):** the four-surface split is real — every
> exporter ships a `transtyle` manifest declaring `irSpec`, `pluginApi`,
> `targets` ranges and `modes`, `plugin-kit` validates its shape and its
> compatibility in CI, and core checks `irSpec` and `pluginApi` at load time
> (`TST1309`). What does **not** exist yet: no target version can be
> requested, no profile is selected, and no lockfile is written. This page
> marks those inline instead of describing the whole model in the present tense.

Four independently-versioned surfaces. Conflating them is how ecosystems end up with "plugin works only with CLI 3.2.1" misery; separating them is how Babel and ESLint survived a decade of plugins.

| Surface                 | Versioned as                      | Stability promise                                                                                                                                                                               |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IR spec**             | `ir/v0`, `ir/v1`… (major.minor)   | The slowest-moving artifact. Minor = additive only (new optional slots/types). Major = migration guide + `transtyle migrate` codemod. Token files written by users are covered by this promise. |
| **Plugin API**          | its own semver (`pluginApi: "0"`) | Interfaces + `plugin-kit`. Core supports ≥2 adjacent majors during deprecation windows so the plugin ecosystem never has to move in lockstep.                                                   |
| **CLI / core packages** | normal npm semver                 | UX may evolve fast; `report.json` and other machine outputs get schema fields so CI consumers survive changes.                                                                                  |
| **Each exporter**       | its own npm semver                | Independent release cadence — a Bootstrap 5.4 release must be shippable the same week without touching core.                                                                                    |

### Load-time compatibility check

Core checks each exporter's declared `irSpec` and `pluginApi` when it loads it, before the exporter's options schema or `emit` is trusted (`packages/core/src/compat.js`):

- **`pluginApi`** is a semver range (`"0"`, `"^0"`, `">=0 <2"`, `"0 || 1"`) that must accept one of the plugin API versions core implements (`PLUGIN_API_VERSIONS`, exported by `@transtyle/core`: `0.0.0` today, the pre-freeze line). A list rather than one version is how "≥2 adjacent majors during deprecation windows" is kept: core lists both, and an exporter declaring either range loads. `"0"` is the range every official exporter declares: any `0.x`.
- **`irSpec`** is compared against `IR_SPEC` from `@transtyle/ir`. The IR spec has no version number before the freeze (`v0-draft`), so it is a marker and must match exactly: an exporter declares `"irSpec": "v0-draft"`. Once the IR spec carries a version, a range-valued `irSpec` is checked as a range by the same code; a marker stays an exact match.

A mismatch is `TST1309` (error), one per field, naming the target, the exporter package and its version, what it declares and what this core provides, with the fix: _`Exporter "bootstrap" (@transtyle/exporter-bootstrap 0.1.0-alpha.3) is built for IR spec "v1"; this @transtyle/core produces "v0-draft"`_. Every target is checked in the same run and nothing is written. An exporter package with no `transtyle` manifest, or one without either field, raises `TST1310` (warning) and loads as before. The range syntax is a zero-dependency subset of node-semver (partial and x-ranges, `^`, `~`, comparators, hyphen ranges, `||`; no prerelease tags) in `packages/core/src/semver.js`.

The check needs the manifest, so it runs when the caller's `loadExporter` returns `{ plugin, manifest, package }` (the CLI's loader does, reading the exporter's `package.json`); a caller that returns the bare plugin, as the repository's scripts do, skips it. `plugin-kit`'s `manifest-compatible` check runs the same function, so an exporter's own CI fails on a wrong value first.

## Target framework versions ([ADR-0006](../adr/0006-version-ranges.md))

**This whole section is specced.** Today an exporter's target era is chosen by an explicit option (shadcn's `era: tailwind-v3 | tailwind-v4`, daisyUI's `v5`) and every exporter documents the framework version it was built against; there is no version argument, no profile selection, and no `--force-profile`. The model below is what the manifests' `targets` ranges are there to support.

The vision pitched `transtyle build bootstrap 5.3.8` — patch-level targeting. We deliberately weaken this to **range-based compatibility**:

- Exporters declare supported ranges per framework: `"bootstrap": [">=5.2 <5.3", ">=5.3 <6"]`, each backed by a mapping profile.
- Users request a version (`bootstrap@5.3.8`, or pinned in config); core selects the covering profile. The _requested_ version is recorded in the build manifest; the _profile_ determines output.
- Theming surfaces change at minor boundaries (Bootstrap 5.3 added `-bg-subtle` and CSS-var theming), essentially never at patch boundaries. Claiming per-patch fidelity would create a combinatorial testing obligation no maintainer team survives, for zero real-world benefit.
- If a patch release _does_ change theming behavior, the exporter ships a narrowed profile — the mechanism supports precision; we just don't promise it universally.
- Requesting an uncovered version fails with the supported ranges listed; a `--force-profile` escape hatch exists for "5.4 just came out, the 5.3 profile probably works" moments, and the coverage report notes the mismatch.

## What triggers what (worked examples)

- _Bootstrap 6 releases_ → exporter major or minor (new profile), no core change.
- _New semantic slot added to catalog_ (e.g. `color.link`) → IR spec minor; exporters opt in when ready; coverage reports "slot unmapped by this exporter version" in the meantime.
- _Standard derivation rule-pack changes a formula_ → new rule-pack version (`standard@2`); users upgrade explicitly in config; `transtyle diff` shows the resulting token changes ([derivation.md](derivation.md)). Until the catalog freeze is armed (the first non-prerelease version), [ADR-0010](../adr/0010-pre-release-breaking-changes.md) lets `standard@1` change in place instead, with regenerated fixtures and a worklog note: the `default-text` and `swap-neutrals` rules (2026-10-09) landed that way.
- _Exporter `emit` output format improves_ (same inputs, different file contents) → exporter minor at least, and release notes must say "regenerated output will differ" — byte-determinism is promised per version set, not across upgrades.

## Reproducibility

**Specced.** `transtyle.lock` (generated) would record: core/CLI versions, every plugin version, rule-pack version, IR spec version. Committed to the user's repo. `transtyle build --frozen` (default in CI) fails on any drift. This is the Terraform lockfile lesson applied to design systems: a theme regenerated two years later must either be identical or fail loudly asking to upgrade intentionally. Tracked as [issue #1](https://github.com/transtyle/transtyle/issues/1).

## Deprecation policy

Anything public follows: deprecate in a minor (runtime warning + docs) → remove no sooner than the next major → every removal ships a migration note and, where mechanical, a codemod. Boring, standard, non-negotiable — this is the tax of asking companies to make us their source of truth.
