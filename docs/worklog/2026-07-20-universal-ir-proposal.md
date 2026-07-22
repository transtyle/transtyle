# 2026-07-20 — Proposal 0001: the universal token IR

> **Later correction (same day):** this entry describes the proposal's _original_ additive-minor/alias posture and its "v1" framing, as first delivered. Both were superseded within the day — see [ADR-0010](../adr/0010-pre-release-breaking-changes.md) and [the follow-up worklog](2026-07-20-catalog-revision-plan.md): the catalog is revised in place as a breaking change, and there is no version bump — the spec stays `v0`. Kept as-is below for the historical record.

Maintainer redirected implementation work to a spec-level question: make Transtyle the most design-system-agnostic token language possible — a true universal IR. Deliverable: [docs/proposals/0001-universal-token-ir.md](../proposals/0001-universal-token-ir.md), a complete specification proposal (comparative study, redesigned taxonomy, naming/aliasing/inheritance/extension rules, per-ecosystem conversion strategies, worked translations, loss analysis, migration plan).

## The study

Fourteen ecosystems compared per category (tiers, color structure, surfaces/elevation, content hierarchy, scales, typography, motion, z/breakpoints, states): Material 3, Ant Design v5, Fluent 2, Carbon v11, Spectrum, Radix, Chakra v3/Panda, Mantine, shadcn, Tailwind, daisyUI, Bootstrap, Open Props, Base UI (+ DTCG).

## The central finding

Every mature system samples the same **two-axis role grid** — prominence (`tint → outline → solid → text`) × interaction state (`rest → hover → active → selected → disabled`) plus on-colors — and each names its own sparse sample of it: Radix's 12 steps, Ant's 10 map tokens, Bootstrap's subtle triad, Chakra's colorPalette set, M3's container/on pairs, Mantine's variant names. Transtyle v0's `base/hover/active/subtle/contrast` scale is itself such a sample, which is why three shipped exporters needed private conventions (F10's border mix, `-text-emphasis` semantics, Storybook `Selected`) — cells the catalog couldn't name.

## The proposal in one line

Catalog v1 = v0 + the full role grid + an elevation ladder + a four-rung content hierarchy + role **archetypes** (custom roles that derive/export like built-ins) + reserved mode dimensions — all landed as additive minors with every v0 name kept as a permanent alias, grid rules shipping as `standard@2` per the freeze policy, and the future Radix Themes exporter as the grid's acceptance test.

## Status

**Proposed, not ratified.** Nothing shipped changes; implementation stays paused per the maintainer's instruction until the proposal is reviewed. (In-flight css-variables exporter work sits uncommitted; its wiring was rolled back pending this review.)
