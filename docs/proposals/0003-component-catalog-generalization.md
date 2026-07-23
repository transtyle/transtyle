# Proposal 0003 — Generalizing the shared component catalog (AL2)

**Status: accepted, implemented 2026-07-23.** Mandated by the [first-alpha definition](../../ROADMAP.md) task AL2: generalize the shared `component.*` catalog from the two real component-heavy implementations — `exporter-primeng` (C3–C6) and `exporter-bootstrap` (AL1) — under [component-layer.md](../specs/component-layer.md)'s additive-only discipline. Evidence input: [the Bootstrap cross-walk findings](../findings/bootstrap-component-crosswalk.md) and [the C1 cross-ecosystem study](../findings/component-tier-study.md).

## The bar this proposal applies

The meta-language principle says nothing enters shared vocabulary until **two independent exporters need the identical thing**. AL2 sharpens it, because "both libraries have a padding for X" is true of almost every component and would rebuild the N×M matrix [component-layer.md](../specs/component-layer.md) exists to avoid:

> **Promote on _architectural_ correspondence, not nominal correspondence.** Both upstreams must treat the meaning the same structural way — not merely both happen to have a value for it. Everything else stays exporter-private, where it already works.

The discriminator in practice: if an author writes this token once, do both targets produce a correct, non-arbitrary result — or does one of them need us to invent a mapping?

## Promoted

### 1. `component.control.{radius, padding-x, padding-y}` — shared interactive-control geometry

The evidence is architectural on both sides, and it is the same architecture:

|                             | Bootstrap 5.3                                                                                           | PrimeNG (Aura)                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Shared root                 | `$input-btn-padding-{x,y}` — one root for buttons **and** inputs                                        | `formField.{paddingX,paddingY,borderRadius}`                                                                                         |
| Button's relationship to it | `$btn-padding-y: $input-btn-padding-y !default` — button **defaults from** the shared root, overridable | `buildButton` reads the same `field()` object its inputs read ([descriptors.js](../../packages/exporter-primeng/src/descriptors.js)) |
| Result                      | two-level model: shared control → per-component override                                                | same two-level model                                                                                                                 |

Neither library merely "has button padding": both deliberately **couple button geometry to form-control geometry, with a per-component override on top**. Two independent upstreams choosing the same structure is exactly the signal the promotion bar is looking for. Both exporters had also, independently and before this proposal, mapped their own upstream onto the same catalog rungs (`space.4`/`space.2`/`radius.control`), so promotion changes no unauthored output.

**Shape:** `control.*` defaults from the semantic tier (`space.4`, `space.2`, `radius.control`); `button.*` defaults from `control.*` via the new `component:` form of `defaultFrom`. Authoring `control.*` moves buttons and fields in both targets; authoring `button.*` moves only buttons.

**This also resolves AL1.2's contested call #1.** Bootstrap's binding used to point `$input-btn-padding-*` at `component.button.*`, so authoring "button padding" silently moved form fields — documented honestly, but wrong. Now each level binds to its own slot and the coupling is the catalog's, matching Bootstrap's own.

### 2. `semantic.opacity.disabled` — the one shared opacity meaning

PrimeNG hardcoded `disabledOpacity: '0.6'` with the comment "no Transtyle equivalent to derive from" — a want recorded months before Bootstrap was cross-walked. Bootstrap independently needs it three times (`$btn-disabled-opacity` .65, `$form-check-input-disabled-opacity` .5, `$btn-close-disabled-opacity` .25). Same meaning, both upstreams, neither derived from the other.

Promoted as **one slot, not an opacity ladder** — the semantic tier, since the meaning is a cross-component state convention rather than one component's geometry. The targets' differing literals (.6/.65/.5) are exactly why a shared authorable slot beats three private constants; bindings that shift a target's native default are classed `approximated` with a note.

## Deferred, with reasons (this is the substance of the pass)

**The sm/lg size ladder.** Both targets have one — and they disagree on the rungs (PrimeNG `sm.paddingX` = `space.3`, Bootstrap `$input-btn-padding-x-sm` = `space.2`; `lg` diverges too). The disagreement _is_ the finding: there is no convergent value to promote, only a convergent shape, and promoting the shape would force one target off its native proportions for no authoring gain. Stays exporter-private. Revisit if a third target's ladder matches one of the two.

**Nav / list item padding.** Both upstreams have it (Bootstrap `$nav-link-padding-*`; PrimeNG `navigation.item.padding`, `list.option.padding`). Rejected as **nominal, not architectural**: nothing structural links the two beyond "menus have padded items", which is true of every component in every library — the bar that would explode the catalog. Both exporters derive these from `space.*` today and produce native results.

**Table cell padding.** Single-source: PrimeNG's DataTable is `unsupported` (structural residue, C5), so there is no second consumer at all.

**Component sizing** (dialog widths, tooltip max-widths, spinner/icon geometry — 20+ Bootstrap `unsupported` slots) and **icon/asset slots** (13 Bootstrap SVG data-URIs). Single-source; PrimeNG themes carry neither. Assets are additionally a likely permanent non-goal — they are not tokens. Recorded so a future pass rejects them deliberately rather than by omission.

**Overlay/scrim veil strength + mask timing.** ~~A genuine shared near-miss… the missing piece is an alpha convention.~~ **Resolved 2026-07-23 by the follow-up overlay pass — with no catalog addition, because the premise was wrong.** `semantic.color.scrim` does not "carry the color but not the alpha": its value is a colour _with an alpha channel_ (`{l, c, h, alpha}`), so the veil strength was already in the IR and already authorable. Nothing needed promoting; two exporters needed fixing:

- **Bootstrap** splits a veil into `$modal-backdrop-bg` + `$modal-backdrop-opacity` (never one rgba), which is why the alpha looked missing. Both halves now read `semantic.color.scrim` through a new `part: 'opaque' | 'alpha'` recipe form — a formatting concern in the exporter, not vocabulary. `$offcanvas-backdrop-*` chains from them, so the offcanvas veil follows for free.
- **PrimeNG** hardcoded `mask.transitionDuration: '0.3s'`; it now reads `duration.normal` (`approximated`, nearest rung). Removing a hardcode, not promoting a slot.

Verified: authoring `scrim: oklch(0.2 0.05 260 / 0.82)` yields Bootstrap `$modal-backdrop-bg: #08152c` + `$modal-backdrop-opacity: 0.82` and PrimeNG `mask.background: oklch(0.2 0.05 260 / 0.82)` — one authored token, each target's own native shape.

**The lesson generalizes:** a "missing slot" is sometimes a missing _projection_. Before promoting, check whether the meaning is already carried by an existing value in a form the target simply needs decomposed. This is now the fourth cross-target study in a row (proposal 0001's role grid, C1's archetype groups, AL2's promotions, this pass) to conclude by adding less than it set out to.

## Consequences

- **Unauthored output is unchanged** on both targets — verified: promotion reused the rungs both exporters had already chosen. The only new emissions are Bootstrap variables that were previously `unsupported` (`$btn-disabled-opacity`, `$form-check-input-disabled-opacity`, `$btn-padding-*`, `$input-border-radius`).
- **Cross-target authoring parity now holds**, and is guarded by `check:component-tier`: an authored `component.button.radius` reaches Bootstrap's `$btn-border-radius` **and** PrimeNG's `components.button.root.borderRadius`. Before AL2 it reached only Bootstrap — the two targets disagreed about what authoring a button token meant.
- **ADR-0003 is amended** (not overturned): its evidence preconditions were met as written; its calendar preconditions are waived by maintainer decision. See the ADR's amendment note.
- **The catalog stays small on purpose.** Four promoted slots out of ~700 inventoried Bootstrap variables and PrimeNG's full preset. The exporter-private path remains the default answer, and the deferral list above is the record of what was looked at and consciously left there.
