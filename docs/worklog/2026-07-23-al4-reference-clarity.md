# AL4 (D3) — the reference clarity rewrite

Three load-bearing pages: [`language.md`](../../website/src/docs/language.md), [`derivation.md`](../../website/src/docs/derivation.md), [`configuration.md`](../../website/src/docs/configuration.md). D3's acceptance is "each concept carries a worked example and one analogy; nothing contradicts the frozen specs."

**Sequencing note, per the AL4 ledger entry:** D3 was marked "after R2", and R2 ratifies on R1's practitioner sign-off — which is explicitly _not_ alpha-gating. R1 has not landed, so this pass proceeded against the [ADR-0011](../adr/0011-v0-freeze-readiness.md) draft, as the ledger provided for. The spot-check below is against that draft's guarantee table; nothing here depends on R2 ratification, because every guarantee in that table is already backed by a CI script rather than by prose.

The pages were in better shape than expected — the interlingua analogy, the role-grid derivation table, the false-friends table all held up. So the pass was mostly about two contradictions and one large omission, all found by checking claims against what the compiler actually does rather than by re-reading the prose.

## Contradiction 1: "exactly one dimension"

`configuration.md` said the mode skeleton "supports exactly one dimension." The flagship example declares **two** — `color-scheme` and `density` — and compiles four full token maps (`light+comfortable`, `light+compact`, `dark+comfortable`, `dark+compact`). The claim was left over from before the T8 multi-dimension work.

Rewritten around the real Acme config, with the two constraints that actually apply: one dimension _per layer_ (`TST1110`), and exporters expressing only what their target can express — `density` surfaces as an honest `dropped` row on Bootstrap and PrimeNG rather than being flattened.

## Contradiction 2: the page claimed to be complete and wasn't

`language.md` opens with "This page is the full pivot vocabulary as implemented today." The string `component.` appeared **zero times** across all three reference pages. The component tier — AL1/AL2, the centerpiece of the alpha definition, the thing the whole "map ALL tokens" ambition rests on — was documented only on the Bootstrap exporter page.

Added to both places it belongs, from different angles:

- **`language.md`** gets the tier as vocabulary: the six slots, and the layering intent that no flat vocabulary can state — `component.control.radius` moves buttons _and_ inputs, `component.button.radius` moves only buttons, one line each. Plus a "why it isn't bigger" section: 657 Bootstrap variables and 2759 PrimeNG slots were available to mint slots from, and the two-independent-exporters rule is what stops the catalog from ending up shaped like whichever target was read last. Both an acceptance (control padding/radius — architectural correspondence) and a rejection (the `sm`/`lg` ladder — both targets have one and _disagree about the rungs_, which is the finding).
- **`derivation.md`** gets the tier as mechanism: `defaultFrom`, the `component:` prefix, and the AL5 rule that a slot whose source doesn't exist is absent rather than present-and-empty.

Also rewrote "how the language grows" to state the evidence rule explicitly and list the current named growth signals — component icons/assets, component geometry, breakpoints, compositional opacity — all of which are now _measured_ from coverage reports rather than asserted.

## Stale numbers

`derivation.md` claimed derivation is "the reason 11 tokens can produce a complete 33-variable theme." Measured: Acme authors **39** DTCG tokens, which resolve to **270 slots per mode**, of which shadcn alone emits **103** CSS custom properties. The old figures predate the catalog revision by a wide margin.

## Worked examples added

Every one is real output, not illustrative:

- **`derivation.md`** — a full `transtyle explain semantic.color.primary.tint` trace, pasted verbatim, showing the rule (`mix-toward-surface(0.92)@standard@1`) and both inputs resolving back through their aliases to the authored blue and gray. Read bottom-up it is the entire life story of a value nobody wrote.
- **`configuration.md`** — the three-layer token stack with a table of what each file contributes and why the mode-scoped layer never repeats anything; and the two-dimension `modes` block with the four combinations it produces.
- **`language.md`** — the two authoring intents side by side, and what each produces on two targets that model the button/input relationship incompatibly.

Analogies, one per concept: layers as **transparent sheets on a lightbox** (later ones paint over earlier ones), derivation as **water finding its level** (fills what you left empty, flows around what you placed), alongside the existing interlingua/pivot-language framing for the catalog itself.

## A guard bug found by writing the docs

Documenting `semantic.color.text.base` in a config example failed `check:sync`: the dead-vocabulary guard's dotted-path pattern flagged it as the removed `<role>.base` grid cell. But `text.base` is current vocabulary — the content-hierarchy anchor — and the guard's _nested-JSON_ pattern already excused it (`"text": { "base": … }` is in its MUST_NOT list). Only the dotted form had never been taught the exception.

Fixed in both directions, with the self-test extended: `semantic.color.primary.base` still matches, `semantic.color.text.base` and the `link.*` cells no longer do.

That fix retired the last entry on `DEAD_VOCAB_EXCLUDE_FILES` — `language.md` had been hand-review-excluded from the guard, and the only remaining trip was a shorthand table cell (`` `text.base` / `.muted` / `.subtle` ``) whose bare `.subtle` defeated the pattern's `(?<!text)` lookbehind. Spelling the rungs out fixed the clarity and the guard at once, so the exclusion list is now **empty**: every page is checked, none is exempt.

## Spot-check against ADR-0011's guarantee table

Every IR guarantee in the table is stated consistently across the three pages: the 8-role grid (`check-grid.mjs`, 54 slots both modes), the elevation ladder, custom-role archetypes deriving a full grid, `palette.categorical.1–5` frozen as a cross-target contract, deterministic derivation, and provenance on every resolved value. No page claims a stability guarantee the audit didn't certify, and the pre-release/post-publication growth rule (ADR-0010) is stated where the catalog is described.

`check:all` green at 62; the site builds (28 pages).
