# Naming

`ds-exporter` must be replaced before any public release: it undersells the product ("exporter" implies one-way, mechanical output — the product is a compiler with importers, derivation, and analysis), and "DS" collides with data science.

## Criteria

A name should be: pronounceable in most languages; short enough for a CLI binary; available as npm scope, GitHub org, and .dev/.com domain; free of trademark conflict with existing dev tools; and evocative of *translation/compilation* rather than *design* alone (the design-tool space is crowded with color/paint metaphors).

## Candidates (availability unchecked — verify npm/GitHub/domains/trademarks before committing)

| Name | Rationale | Risk |
|---|---|---|
| **Tokamak** | Token + fusion reactor: contains and transforms energy (tokens) into usable output. Distinctive, technical audience will love it. | Possible npm collisions; physics naming is common. |
| **Transmute** | Alchemical transformation; verb-able ("transmute your DS to Bootstrap"). | Generic word, likely npm squatting. |
| **Dialekt** | Design systems as dialects of one language; the tool translates between them. Matches the compiler framing exactly. | i18n-library connotations for "dialect". |
| **Alloy** | Many metals, one material; strong + composable. | Heavily used name in software (Alloy analyzer, Titanium Alloy). |
| **Portage** | Carrying a boat between waterways — moving a DS between ecosystems. | Gentoo package manager collision. |

Recommended shortlist for the availability check: **Tokamak**, **Dialekt**, **Portage**.

## Provisional identifiers used throughout the docs

Until the name is settled, all documents use these placeholders consistently. Renaming is a find-and-replace, not a redesign.

| Placeholder | Used for |
|---|---|
| `dsx` | CLI binary and config prefix (`dsx.config.json`) |
| `@ds-exporter/*` | npm scope (`@ds-exporter/core`, `@ds-exporter/exporter-bootstrap`, …) |
| `dsx.*` | Extension namespace inside DTCG `$extensions` (e.g. `dsx.modes`) |

**Naming consequence to remember:** the `$extensions` namespace ships inside *users' token files*. Once released, that string is effectively frozen (or must be aliased forever). The real name must be chosen **before** the first public release of the IR spec — this is a Phase 0 blocker in [ROADMAP.md](../ROADMAP.md).
