# Versioning and compatibility model

> **Status (re-verified 2026-08-29):** the four-surface split is real — every
> exporter ships a `transtyle` manifest declaring `irSpec`, `pluginApi`,
> `targets` ranges and `modes`, and `plugin-kit` validates its shape in CI.
> What does **not** exist yet is core reading any of it: no range is checked at
> load time, no version can be requested, no profile is selected, and no
> lockfile is written. [ADR-0011](../adr/0011-v0-freeze-readiness.md) recorded
> that gap as the reason the plugin API freeze is deferred; this page now marks
> it inline instead of describing the whole model in the present tense.

Four independently-versioned surfaces. Conflating them is how ecosystems end up with "plugin works only with CLI 3.2.1" misery; separating them is how Babel and ESLint survived a decade of plugins.

| Surface                 | Versioned as                     | Stability promise                                                                                                                                                                               |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IR spec**             | `ir/v0`, `ir/v1`… (major.minor)  | The slowest-moving artifact. Minor = additive only (new optional slots/types). Major = migration guide + `transtyle migrate` codemod. Token files written by users are covered by this promise. |
| **Plugin API**          | its own semver (`pluginApi: ^0`) | Interfaces + `plugin-kit`. Core supports ≥2 adjacent majors during deprecation windows so the plugin ecosystem never has to move in lockstep.                                                   |
| **CLI / core packages** | normal npm semver                | UX may evolve fast; `report.json` and other machine outputs get schema fields so CI consumers survive changes.                                                                                  |
| **Each exporter**       | its own npm semver               | Independent release cadence — a Bootstrap 5.4 release must be shippable the same week without touching core.                                                                                    |

**Specced:** core checking those declared ranges at load time and refusing a mismatch with an actionable diagnostic ("exporter-bootstrap 2.x requires IR spec v1; you are on v0 — upgrade the exporter or pin core"). The manifests exist and are shape-checked by `plugin-kit`; nothing in the compile path reads them, which [ADR-0011](../adr/0011-v0-freeze-readiness.md) §2 identifies as the concrete blocker on freezing plugin API v0. Until it lands, an incompatible exporter fails in whatever way its code happens to fail.

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
- _Standard derivation rule-pack changes a formula_ → new rule-pack version (`standard@2`); users upgrade explicitly in config; `transtyle diff` shows the resulting token changes ([derivation.md](derivation.md)).
- _Exporter `emit` output format improves_ (same inputs, different file contents) → exporter minor at least, and release notes must say "regenerated output will differ" — byte-determinism is promised per version set, not across upgrades.

## Reproducibility

**Specced.** `transtyle.lock` (generated) would record: core/CLI versions, every plugin version, rule-pack version, IR spec version. Committed to the user's repo. `transtyle build --frozen` (default in CI) fails on any drift. This is the Terraform lockfile lesson applied to design systems: a theme regenerated two years later must either be identical or fail loudly asking to upgrade intentionally.

## Deprecation policy

Anything public follows: deprecate in a minor (runtime warning + docs) → remove no sooner than the next major → every removal ships a migration note and, where mechanical, a codemod. Boring, standard, non-negotiable — this is the tax of asking companies to make us their source of truth.
