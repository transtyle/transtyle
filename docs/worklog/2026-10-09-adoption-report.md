# An adoption report, and false-friend bindings (TST1124)

Issue [#61](https://github.com/transtyle/transtyle/issues/61), as refined on the
issue (sections 1 to 5 and the addendum from the three-token canvas fix,
[worklog](2026-10-09-three-token-canvas.md)).

## The gap

After binding, a team had no view of what was left on its side: which of its own
semantic tokens no catalog slot reads (they reach css-variables verbatim and no
other target), and which bindings repeat the name-similarity mistake the
[false friends](../../website/src/docs/language.md#false-friends) table warns
about. Both were found by reading `report.json` by hand, or not at all: the
three-token fixture of `check:minimal-ds` authored `semantic.color.surface` as
its page background for months, and nothing said a word.

## What landed

- `adoption(normalized)` in `@transtyle/core` (`packages/core/src/adoption.js`):
  `{ custom, bound, unbound: [{ path, type, hints }], roles }`. `check` prints it
  after the diagnostics (nothing for a project with catalog paths only), and
  `check --json` carries it as `adoption`.
- A custom token is a `semantic.*` path that is not a catalog slot nor a cell of
  a custom role. Bound follows the alias chain and composite members, from every
  catalog slot and custom role cell, in every mode combination.
- Hints for an unbound token: the name hint first (a catalog slot with a middle
  part left out, same type: `surface` → `elevation.0.surface`), then catalog
  slots within ΔE<sub>OK</sub> 0.05 in the default mode, at most three, the ones
  the project set (authored or bound) before the ones the engine filled.
- `TST1124` (info): `secondary.solid` bound to a `secondary`-named token within
  0.05 of `neutral.tint`, `accent.solid` bound to an `accent`-named token within
  0.05 of `primary.tint` or `neutral.tint`. Both signals, word and value, are
  required. Once per word, in the mode where it is closest.

## Measured

Each example compiled with the chain-following definition:

| Example | Custom semantic tokens | Unbound                                                                     | Custom roles | TST1124 |
| ------- | ---------------------- | --------------------------------------------------------------------------- | ------------ | ------- |
| acme    | 0                      | 0                                                                           | 0            | none    |
| cathode | 7                      | 0                                                                           | `crt-amber`  | none    |
| govuk   | 14                     | 1: `govuk.focus-text`, "same value as `text.base` (bound via `govuk.text`)" | 0            | none    |
| carbon  | 15                     | 0                                                                           | 0            | none    |

Carbon has 15 custom tokens, not the 14 the refinement counted on 69dd3fb: it
gained one since, bound like the others. On the scaffold's blue brand,
`secondary.solid` bound to `option.color.secondary`: `oklch(0.97 0 0)` (shadcn's
`--secondary`) is ΔE 0.020 from `neutral.tint` and gets the note;
Bootstrap's `#6c757d` and an orange `#e8590c` stay silent, and so does the same
gray under the name `gray-100`. `check:cli` holds all of these as golden cases,
with the `surface` fixture and a two-hop custom chain.

## Deviations from the refinement

- **`isCatalogSlot` lives in `@transtyle/core`, not `@transtyle/ir`.** The
  refinement predates `catalog()` (#153), which reads the slot list off a probe
  compile of the engine. A list in `ir` would have been a second, hand-kept copy;
  `isCatalogSlot` reads the same probe, and `check:grid` (e) checks that every
  slot the engine fills on the four examples passes it.
- **`compile()` does not return `adoption`; core exports `adoption()`.** The
  report needs the catalog probe, which `build` has no use for, so only `check`
  pays for it.
- **The accent row also compares with `neutral.tint`.** shadcn's stock themes
  give `--accent` the same near-white gray as `--secondary`, `oklch(0.97 0 0)`.
  Measured from that gray: ΔE 0.026 (Acme), 0.033 (GOV.UK), 0.041 (Carbon) and
  0.020 (a saturated red brand) to `primary.tint`, and 0.020, 0.022, 0.037 and
  0.006 to `neutral.tint`, always the closer one. Carbon sits near the
  threshold with `primary.tint` alone. A near-white gray as a brand emphasis
  colour is not a real case, so the second cell costs no false positive.
- **Engine-filled value hints are left out when the project set a match or a
  name hint exists.** On GOV.UK, `focus-text`'s black also equals two derived
  cells (`neutral.text-strong`, `text.disabled`); listing them buries the one
  that matters.
- **The option-duplicate bullet is not here.** It moved to #62 (decided on the
  issue), which shipped it as `TST1115`.

## Left out

- Per target, an unbound custom token is a loss the coverage report could name
  (a `dropped` row on closed-set targets): #51.
- Ranked binding suggestions are `bind --suggest` (#60), which landed in parallel: it goes from each unbound catalog slot to a project token,
  the report goes from each project token to the slots. The two share no code
  yet; its colour ranking and these value hints could meet in one helper.
- `muted`, `outline`, `subtle` and `selected` have no value signal or no slot of
  that name, so no false-friend row; `FALSE_FRIENDS` in `adoption.js` is where
  one goes.

## Deviation from the plan

- The false-friend code is `TST1124`: `TST1122` is taken by an open PR and
  `TST1123` by the DTCG colour objects (#196), so this is the next code free on
  `main`.
