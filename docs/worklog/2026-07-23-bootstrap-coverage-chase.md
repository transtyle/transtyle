# Chasing Bootstrap coverage — what was real, and what wasn't

[AL3](2026-07-23-al3.md) left Bootstrap at **57 `unsupported` + 96 `dropped`** of 657 component-scoped slots. This pass measured every one of those rows before changing anything, and the measurement is most of the result: the great majority are correctly classified, and one of them was a trap.

## The measurement

Grouped by note, the 153 gap rows were: 25 bespoke component geometry, 16 embedded SVG assets, 13 opacity values, 43 cascade no-ops, 29 structural/behavioral options, 18 shade/tint derivation knobs, 3 CSS filter tricks, and a handful of singletons (`$box-shadow-inset`, `$display-font-sizes`, `$grid-breakpoints`). Assets, knobs, filters, and structure are genuinely unmappable by meaning — they stay exactly where they are. The 43 cascade no-ops were the only large group where the classification itself was wrong.

## The real finding: Bootstrap has PrimeNG's `inherited`, and we weren't counting it

PrimeNG's bar counts a slot as covered when Aura's default is a **reference** into a semantic path we drive — that's the `inherited` reason, and it is real coverage because it is how PrimeNG is designed to be themed. Bootstrap has the identical mechanism in different syntax: `null` on an **inherited** CSS property means "emit no declaration", so the element takes the ancestor's value — and for 22 slots that ancestor is something this exporter drives, per mode, correctly. `$card-subtitle-color`, `$input-btn-font-family`, `$nav-link-font-size`, `$toast-color`, `$pre-color`, `$table-group-separator-color`, and 16 more.

Calling those `dropped` on one target while counting them on the other was an inconsistency between the two bars, not a conservative choice. They are now `inherits-driven` → class `derived`, each carrying a per-variable note naming what it inherits _from_.

Membership is a hand-written per-name list, never inferred from the marker, because the split is a genuine judgment. Two shapes that look identical are excluded: **non-inherited** properties (`box-shadow`, `background`, `border-radius`, `height`, `margin`, `transition`, `filter`) where `null` means nothing reaches the slot at all, and **inherited-but-structural** properties (`white-space`, `cursor`) where the inherited value is real but isn't a theme value. Unlisted names still fall through to `dropped`, so a new upstream `null` is never silently claimed as covered.

## The trap: the coverage win that would have made rendering worse

The obvious next move was binding those same slots to the IR colors that describe them — `$card-subtitle-color` ← `semantic.color.text.muted`, `$input-disabled-color` ← `text.disabled`, `$hr-border-color` ← `color.border` (plus neutralizing `$hr-opacity` to 1). It was implemented and then thrown away.

None of those slots has a `--bs-*` counterpart, so the only emission path is Sass, which bakes a single literal. The IR colors are mode-varying. Baking the light value gives a wrong dark mode — whereas leaving the slot alone lets it inherit `--bs-body-color`, which this exporter already drives correctly in _both_ modes. The bar would have gone up by 6 and the demos would have regressed. That is precisely the failure mode the AL3 bar exists to catch, caught this time on the authoring side rather than the measuring side.

## What was genuinely bound (3 slots)

Not because the slot was empty, but because Bootstrap's default is **incoherent with a meaning it already carries**:

- `$form-label-font-size` / `$form-label-font-weight` ← `semantic.type.role.label.md`. The IR's type roles say a label is its own role (0.8rem/500 for Acme, not body 1rem/400), and Bootstrap has the exact two slots to say so. This is the first time a type-role _composite_ reaches Bootstrap's component tier; `resolveEmits` gained composite-member `part`s (`fontSize`/`fontWeight`/`lineHeight`) alongside the existing color `part`s, and `check:bootstrap-surface` now rejects a `part` that doesn't exist on the resolved composite (a typo'd `fontsize` would otherwise have emitted `$var: undefined;`).
- `$legend-font-weight` ← `semantic.type.role.title.md`. Bootstrap sets a 1.5rem legend and then inherits body weight; a legend is a fieldset's title, so size and weight now come from one meaning.

## One note corrected

`$btn-close-disabled-opacity` was filed under "an opacity with no shared meaning — a veil strength, a shimmer range, or a glyph alpha." That was wrong: it is _exactly_ `semantic.opacity.disabled`. It still can't be bound, for a different and more interesting reason — Bootstrap composes it against the glyph's own resting alpha (`$btn-close-opacity: .5`), so writing the catalog's 0.6 would make the disabled close button **more** visible than the enabled one. It needs a compositional recipe (catalog factor × the target's resting alpha) the cross-walk has no form for. It stays `unsupported`, now with a note that says the true reason — a real AL2-style growth signal instead of a mislabel.

## Measured effect

`58 native · 469 derived · 34 approximated · 57 unsupported · 96 dropped`
→ **`58 native · 494 derived · 34 approximated · 57 unsupported · 71 dropped`**

25 rows moved out of `dropped` (22 reclassified, 3 bound). `unsupported` is unchanged, which is the honest outcome: what's left there is assets, component geometry, derivation knobs, and breakpoints — named catalog-growth signals, not oversights. The spec's classification counts were also stale from the AL2/overlay passes and are now recomputed from the descriptors (90 bound · 284 chained · 138 follows-global · 22 inherits-driven · 18 inherit-default · 51 dropped · 54 unsupported = 657).

`check:all` green at 61.
