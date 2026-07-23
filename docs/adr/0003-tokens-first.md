# ADR-0003: v1 ships foundations only; component layer deferred to v2

**Status:** accepted; **amended 2026-07-23** (see [Amendment](#amendment-2026-07-23-component-tier-pulled-into-the-first-alpha))

## Context

The vision includes abstracting components (Button, Modal, Combobox…) across ecosystems. Cross-framework component abstraction is where comparable projects died (Diez; "write once render anywhere" DSLs): behavioral and compositional models are irreconcilable, and the fidelity matrix grows as targets × components × framework versions.

## Decision

v1 compiles foundations only: color, typography, spacing, radius, borders, shadows/elevation, motion, z-index. The component layer is deferred to v2, pre-scoped as component _theming_ (appearance binding to targets' existing theming surfaces), never component _implementation_ generation — see [component-layer.md](../specs/component-layer.md). v1 reserves the `component` token tier in the IR so v2 is additive.

## Consequences

- v1 is shippable by a small team and its promise ("native theme artifacts from one source") is verifiable per target; trust accrues before the harder claim is made.
- v2 gets designed from evidence: real exporters' hand-written component-theming prototypes, not a priori abstraction.
- Cost accepted: v1 does not fully deliver the "translate Bootstrap's dropdown to shadcn" vision; marketing must be disciplined about what "translation" means today.
- Guardrails now: semantic catalog stays component-free (no `button-bg` slots); coverage/manifest formats already accommodate the future tier.

## Amendment 2026-07-23: component tier pulled into the first alpha

**What changed.** The [first-alpha definition](../../ROADMAP.md) (maintainer, 2026-07-23) makes component-tier theming part of the alpha bar rather than a post-v1 phase: a large DTCG-speaking design system must export to rich component libraries with all three tiers mapped. A minimal shared component catalog therefore ships now — see [proposal 0003](../proposals/0003-component-catalog-generalization.md).

**What this decision keeps.** Everything load-bearing in the original:

- **Component _theming_ only, never component _implementation_ generation.** Unchanged and permanent; the trap this ADR was written to avoid is untouched.
- **Designed from evidence, not a priori.** This ADR's own consequence — "v2 gets designed from evidence: real exporters' hand-written component-theming prototypes" — is exactly how the catalog was derived: two shipped exporters (PrimeNG C3–C6, Bootstrap AL1) were built first, then the catalog was generalized from where they demonstrably agree, promoting four slots and rejecting the rest with written reasons.
- **The semantic catalog stays component-free.** The one semantic addition (`opacity.disabled`) is a cross-component state convention, not a component slot; no `button-bg` equivalent exists anywhere in `semantic.*`.
- **Additivity.** Every component slot has a `defaultFrom`, so an empty `component` tier compiles exactly as before.

**What is waived, deliberately.** The _calendar_ preconditions recorded in [component-layer.md](../specs/component-layer.md) — "the token IR has survived ≥1 year of real use" and "≥3 community exporters exist" — are waived by maintainer decision. They were proxies for evidence and stability; the evidence preconditions they proxied for (two real hand-written component-theming prototypes to generalize from) were met literally. The risk accepted: the catalog is being shaped before third-party exporters exist to stress it, so component-tier vocabulary carries a higher chance of additive revision than the semantic catalog does. Mitigation: the tier is deliberately tiny (four slots), every addition is optional refinement, and pre-publication breaking changes remain allowed under [ADR-0010](0010-pre-release-breaking-changes.md).
