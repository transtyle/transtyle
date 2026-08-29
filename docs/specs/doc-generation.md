# Documentation generation

## Scope correction ([ADR-0007](../adr/0007-doc-generation-scope.md))

The original vision: `--doc` downloads a target framework's documentation site, injects the generated theme, rebuilds it, and produces a deployable branded docs site. As stated, this is the blueprint's biggest scope trap:

- Upstream doc sites are **not stable build targets**: Bootstrap's docs are a Hugo site (moving to Astro at their discretion), MUI's a custom Next.js monorepo app. Each is a bespoke, version-drifting build we'd have to keep working forever — N framework doc builds is a heavier maintenance load than N exporters.
- **Licensing differs from code:** e.g. Bootstrap's code is MIT but its docs content is CC BY 3.0; other projects vary. Redistributing rebuilt doc sites needs per-target legal review.
- It breaks the **no-network-at-build** invariant and determinism guarantees.

The underlying user need is real, though: _see and share your brand applied to a target ecosystem_. We meet it in three tiers, cheapest first.

## Tier 1 — Themed preview site (`transtyle preview`, Phase 2, core feature)

Our own static site, generated from build output + report:

- token reference (every semantic slot, per mode, with provenance badges: authored/derived/defaulted);
- native sample renders per target: real Bootstrap markup with the generated theme, shadcn component samples, live ECharts charts with the theme JSON — using each target's _published_ CSS/JS, not rebuilt docs;
- the coverage report, rendered;
- static output → deployable to Netlify/Vercel/GitHub Pages/Cloudflare Pages with zero config (this satisfies the vision's deployability requirement).

Fully deterministic, fully ours, one site to maintain. This is what most companies actually want to send around.

## Tier 2 — Themed Storybook (Phase 1, via the Storybook exporter)

For teams with their own Storybook, the [Storybook exporter](exporters/storybook.md) themes manager + preview. (**Specced:** scaffolding token-reference stories — it emits theme, manager and preview fragments only, and the demo writes its own single story.) Their components, our theme — the highest-value "branded documentation" with none of the upstream-rebuild cost.

## Tier 3 — Upstream doc rebuild (`transtyle doc <target>`, Phase 3, experimental, capability-gated)

The original vision's feature, kept — but honestly scoped:

- Per-exporter opt-in capability (`"capabilities": ["doc"]`); the exporter's `doc()` hook produces a `DocPlan` (fetch source at pinned ref → inject theme artifacts → run upstream build → collect output).
- Explicitly network-using and marked **experimental permanently**: upstream can break it at any time, and the docs say so. It is excluded from our semver stability promises (breakage is a bug report, not a broken contract).
- Pinned upstream refs only (a docs build tracks an exact tag, e.g. `bootstrap v5.3.3`), so when it works, it's reproducible.
- Ships only for exporters where a maintainer commits to keeping it green in scheduled CI; dropped from an exporter when unmaintained rather than left rotting.
- Licensing note in each exporter's docs stating the upstream docs license and what redistribution requires.

## Why this ordering matters

Tier 1 delivers 80% of the demo/deployment value at 5% of the maintenance cost, and every improvement to it benefits all targets at once. Tier 3 is a spectacular demo (a fully branded getbootstrap.com is a marketing asset) — so we keep it, but as a bonus capability that can fail without damaging trust in the core promise. A flagship feature that breaks weekly would read as "this tool is flaky"; an experimental one that mostly works reads as delightful.
