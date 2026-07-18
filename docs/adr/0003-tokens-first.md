# ADR-0003: v1 ships foundations only; component layer deferred to v2

**Status:** accepted

## Context

The vision includes abstracting components (Button, Modal, Combobox…) across ecosystems. Cross-framework component abstraction is where comparable projects died (Diez; "write once render anywhere" DSLs): behavioral and compositional models are irreconcilable, and the fidelity matrix grows as targets × components × framework versions.

## Decision

v1 compiles foundations only: color, typography, spacing, radius, borders, shadows/elevation, motion, z-index. The component layer is deferred to v2, pre-scoped as component *theming* (appearance binding to targets' existing theming surfaces), never component *implementation* generation — see [component-layer.md](../specs/component-layer.md). v1 reserves the `component` token tier in the IR so v2 is additive.

## Consequences

- v1 is shippable by a small team and its promise ("native theme artifacts from one source") is verifiable per target; trust accrues before the harder claim is made.
- v2 gets designed from evidence: real exporters' hand-written component-theming prototypes, not a priori abstraction.
- Cost accepted: v1 does not fully deliver the "translate Bootstrap's dropdown to shadcn" vision; marketing must be disciplined about what "translation" means today.
- Guardrails now: semantic catalog stays component-free (no `button-bg` slots); coverage/manifest formats already accommodate the future tier.
