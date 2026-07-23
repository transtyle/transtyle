# Proposal 0004 — Component geometry: does the catalog need a sizing vocabulary?

**Status: accepted, implemented 2026-07-23.** One slot promoted (`component.tooltip.max-width`), nine concepts rejected with reasons. The rejections are the larger half of the result and are recorded here so the next probe doesn't re-litigate them.

`bespoke component geometry/sizing with no scale meaning` is the largest remaining `unsupported` bucket on Bootstrap — **25 of 657** slots, and the note has been carrying an explicit growth signal since AL1.2: _"the IR has no component-size vocabulary yet."_ This probe tests that signal against the second reference target under [proposal 0003](0003-component-catalog-generalization.md)'s bar.

## The bar

Unchanged from AL2, and it is the whole reason this probe exists rather than a patch:

> Promote on **architectural** correspondence, not nominal correspondence. Both upstreams must treat the meaning the same structural way — not merely both happen to have a value for it.

"Both libraries have a width for their checkbox" is true and means nothing. The 2759-slot PrimeNG inventory contains **243 width/height/size slots**; the temptation to mint catalog slots against them is exactly what the bar exists to resist, because the result would be a vocabulary shaped like whichever target was read last.

## Concept-by-concept

Bootstrap's 25 slots group into ten concepts. Measured against PrimeNG's real inventory (`@primeuix/themes` Aura, drift-guarded):

| Concept                 | Bootstrap                                                                                       | PrimeNG                                                                              | Verdict                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Tooltip max width**   | `$tooltip-max-width: 200px`                                                                     | `tooltip.root.maxWidth: 12.5rem` (**= 200px**)                                       | ✅ **promote** — same concept, same structure, same value, arrived at independently |
| Carousel indicator size | `$carousel-indicator-width: 30px` / `-height: 3px` / `-spacer: 3px`                             | `carousel.indicator.width: 1.75rem` / `height: 0.5rem`                               | ⚠️ architectural, but see "rejected but close" below                                |
| Check-control box       | `$form-check-input-width: 1em`, `$form-switch-width: 2em`                                       | `checkbox.root.{width,height}` + `sm`/`lg` rungs; `toggleswitch.root.{width,height}` | ❌ concept shared, **architecture disagrees**                                       |
| Icon size               | `$accordion-icon-width: 1.25rem`, `$carousel-control-icon-width: 2rem`, `$btn-close-width: 1em` | 50 `icon.size` slots across **31 families**, systematic                              | ❌ asymmetric — see below                                                           |
| Toast width             | `$toast-max-width: 350px`                                                                       | `toast.root.width: 22rem` (= 352px)                                                  | ❌ **false friend** — `max-width` vs `width`                                        |
| Spinner size            | `$spinner-width`, `$spinner-border-width`, + `-sm` pair                                         | `progressspinner` has **zero** geometry slots                                        | ❌ one-sided                                                                        |
| Popover max width       | `$popover-max-width: 276px`                                                                     | none (`popover` has no width slot at all)                                            | ❌ one-sided                                                                        |
| Modal size ladder       | `$modal-sm/md/lg/xl` (300/500/800/1140px)                                                       | `dialog` has no size tokens                                                          | ❌ one-sided                                                                        |
| Offcanvas / drawer size | `$offcanvas-horizontal-width: 400px`, `$offcanvas-vertical-height: 30vh`                        | `drawer` has no size tokens                                                          | ❌ one-sided                                                                        |
| Dropdown min width      | `$dropdown-min-width: 10rem` (the **menu**)                                                     | `multiselect.dropdown.width` etc. — the **trigger button**                           | ❌ false friend, opposite element                                                   |

**Six of ten concepts are one-sided or false friends.** The bucket does not describe a missing vocabulary; it mostly describes decisions Bootstrap tokenizes and PrimeNG hard-codes, and vice versa.

## Promote: `component.tooltip.max-width`

The evidence here is unusually strong — stronger than anything AL2 promoted:

- **Same concept.** Both libraries constrain how wide a tooltip may grow, and neither constrains it with a fixed `width`.
- **Same structure.** A single `max-width` on the tooltip root, in both.
- **Same value.** Bootstrap `200px`; PrimeNG `12.5rem`, which is exactly 200px at a 16px root. Two independently-designed libraries, in different ecosystems, different languages, different decades, picked the identical measure.
- **Uniquely selective on both sides.** PrimeNG has exactly **two** `maxWidth` slots in 2759 (the other is a paginator input). Bootstrap constrains three overlays, and tooltip is the only one PrimeNG also constrains. This isn't two libraries incidentally having numbers — it's two libraries agreeing that _this specific element_ is the one that needs a width ceiling.

The underlying decision is typographic: a tooltip is a short line of text, and ~200px at 0.75rem is roughly a readable measure. That is a design-system-level opinion, which is precisely what belongs in a design-system-level vocabulary.

**Import/export symmetry** (the catalog's standing requirement): a DTCG source can author it; Bootstrap emits `$tooltip-max-width`, PrimeNG emits `tooltip.root.maxWidth`. Both directions are exact — no invented mapping on either side.

**Shape:** `component.tooltip.max-width`, `type: dimension`, no `defaultFrom` — there is no semantic scale rung that means "readable measure", so it stays unset unless authored, and both exporters keep their own default when it is. Adding a `defaultFrom` would require inventing a semantic slot on one target's authority, which is the thing this proposal is refusing to do everywhere else.

## Rejected, with reasons

**Carousel indicator size — architectural, but not worth the slot.** Both targets have indicator `width` + `height` as independent axes; the correspondence is real. It fails a different test: a carousel is one component, its indicator is one ornament of it, and the values disagree by enough (30×3 vs 28×8) that they encode different visual intent — Bootstrap's is a hairline bar, PrimeNG's a rounded pill. Authoring one value would not produce "the same carousel" on both; it would produce two differently-wrong carousels. Kept exporter-private, and recorded here so the next probe doesn't re-litigate it.

**Check-control box — the AL2 size-ladder rejection, again.** Bootstrap says `1em`: one dimension, square by implication, **proportional to local font size**. PrimeNG says `root.width` _and_ `root.height` independently, in `rem`, **absolute**, with a three-rung `sm`/`md`/`lg` ladder. A single authored value cannot satisfy both: it either loses Bootstrap's font-proportionality or invents two of PrimeNG's three rungs. This is the identical shape as AL2's rejected `sm`/`lg` ladder — both targets have the concept and **disagree about its architecture**, and the disagreement is the finding.

**Icon size — asymmetric, and that asymmetry is the signal.** PrimeNG treats icon size systematically: 50 slots across 31 families, with a small shared value set (0.75/0.875/1/1.25/1.75rem) and internal references (`{navigation.item.icon.size}`). Bootstrap has three ad-hoc ones with no shared root. One target has an architecture here and the other has three coincidences; promoting would mean exporting PrimeNG's architecture into the catalog and asking Bootstrap to pretend it has one. **This stays the strongest open growth signal** — if a third target arrives with a systematic icon-size concept, revisit immediately.

**Toast width — the clearest false friend in the set.** `350px` and `22rem` (352px) look like agreement and are not: Bootstrap's toast grows to its content up to a ceiling, PrimeNG's is a fixed width. Same number, opposite box semantics. Worth recording precisely because the numeric near-coincidence is what a naive nominal comparison would have promoted.

**Spinner, popover, modal ladder, offcanvas, dropdown min-width — one-sided.** PrimeNG hard-codes what Bootstrap tokenizes. Nothing to correspond with; these stay `unsupported` with their existing honest note.

## Recommendation

1. **Promote `component.tooltip.max-width`** — one slot, on the strongest evidence the bar has yet seen.
2. **Rewrite the `N_BESPOKE` note.** It currently reads as one undifferentiated growth signal ("the IR has no component-size vocabulary yet"), which this probe shows is wrong: the bucket is six one-sided/false-friend concepts, two architecture-disagreements, and one genuine convergence. A note that promises a vocabulary nobody needs is the coverage-report equivalent of over-claiming.
3. **Keep icon size as the named watch item**, pending a third target.
4. **Do not add a component-geometry family.** The measured answer to "does PrimeNG need the same sizing vocabulary" is **no** — and that answer is worth as much as a promotion would have been, because it is what stops the catalog from growing to 243 slots shaped like one target.

## Implementation (2026-07-23)

All four recommendations landed.

`COMPONENT_CATALOG` gains `tooltip: { 'max-width': { type: 'dimension' } }` — the **first slot with no `defaultFrom`**, which required one engine change: DERIVE now skips catalog entries that declare no default, since an authored value is already carried through by the generic token walk before derivation runs. The slot therefore exists only when authored, and both exporters keep their own default (the same 200px) when it isn't.

Bindings: Bootstrap `$tooltip-max-width ← { comp: 'tooltip.max-width' }`, reaching stock-CSS users through the existing emit path; PrimeNG `components.tooltip.root.maxWidth`, emitted only when the slot resolves.

Verified end-to-end, both directions:

|           | unauthored                                                  | authored `18rem`                                      |
| --------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Bootstrap | not emitted; honest `dropped` row naming the slot to author | `$tooltip-max-width: 18rem;` · `native`               |
| PrimeNG   | not emitted; Aura's `12.5rem` stands                        | `tooltip: { root: { maxWidth: "18rem" } }` · `native` |

`check:component-tier` gained case (e), asserting both halves: the empty-tier compile must **not** conjure the slot (otherwise the exporters would emit a measure nobody chose, on one upstream's authority), and the authored fixture must carry it through with `authored` provenance. `check:bootstrap-surface`'s recipe-path typo guard learned that a no-`defaultFrom` catalog slot is legitimately absent from a compile — checked against the catalog rather than allow-listed by name, so `comp: 'tooltip.max-widht'` still fails.

The `N_BESPOKE` note that started this probe ("the IR has no component-size vocabulary yet") is rewritten, and the bucket split into four honest ones: 17 genuinely bespoke, 4 architecture-disagreement, 3 icon-size watch item, 1 now bound.
