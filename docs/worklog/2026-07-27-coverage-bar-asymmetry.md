# The two coverage percentages are not a ranking

Measuring Bootstrap's "reachable without new catalog vocabulary" pile — the
question the PrimeNG analysis had already answered with **221** — produced a
result worth writing down rather than just acting on: Bootstrap's answer is
**~0**, and the reason is architectural, not effort.

## What was measured

Bootstrap's 127 undriven variables (56 `unsupported` + 71 `dropped`; the 35
`approximated` rows already emit values), tested group by group against
"does semantic vocabulary already exist for this concept":

| Group                 |  n  | Verdict                                                                                                             |
| --------------------- | :-: | ------------------------------------------------------------------------------------------------------------------- |
| structural/behavioral | 29  | Not theme values — cursor, order, vertical-align, transform                                                         |
| cascade no-ops        | 18  | `null` on a **non-inherited** property; the earlier chase already promoted the 22 that were reachable               |
| shade/tint knobs      | 18  | Bootstrap's own derivation parameters — our engine derives the results directly, so these are dead for driven roles |
| bespoke geometry      | 17  | Already tested and rejected by [proposal 0004](../proposals/0004-component-geometry.md)                             |
| SVG assets            | 16  | No asset vocabulary in any tier                                                                                     |
| opacity               | 12  | No shared meaning; `$btn-close-*` needs a compositional recipe                                                      |
| targets disagree      |  4  | Needs a catalog decision, not plumbing                                                                              |
| filter tricks         |  3  | Presentation mechanics                                                                                              |
| icon size             |  3  | The named watch item — needs a third target                                                                         |
| singletons            |  7  | 3 have vocabulary but disagreeing ladders (below)                                                                   |

The 295 slots scoped _out_ of the 657 denominator were also checked, in case
coverage was hiding there. It isn't: ~234 are scoped out precisely _because_
they're already driven at the palette/typography/semantic level, and 22 are
feature flags and build infrastructure.

## Why the two targets differ

PrimeNG resolves `{token.path}` references at runtime, so driving one semantic
path cascades to every component slot pointing at it. Driving `formField.paddingX`
alone reaches Button plus every form component — 1,552 of its covered slots ride
that mechanism, and 221 more sit behind 100 semantic paths the exporter drives
only partially. **One binding, many slots.**

Bootstrap's Sass path binds per variable. There is no multiplier, and the
variables that remain are individually not theme values.

**So the lower percentage is the target with headroom, and the higher one has
converged** — the opposite of how two numbers side by side normally read.
Bootstrap at 77% is done; PrimeNG at 59% has ~8% of genuine room.

## Recorded in three places

Where someone could read the two numbers as a ranking:

- **`docs/specs/validation-and-coverage.md`** — a new "Coverage percentages are
  not comparable across targets" section under the coverage-class table, with
  the measurement, the architectural reason, and three consequences: track a
  target against its own history; a ref-resolving target rewards semantic-tier
  work while a per-variable target rewards exporter-tier work; and an
  `unsupported` row on a ref-resolving target may only mean the exporter hasn't
  driven a path it could — so check before reading it as catalog-growth signal.
- **`scripts/check-coverage-bar.mjs`** — a `READING THE NUMBERS` block in the
  header, plus a footnote **printed with the bar itself**, since the terminal
  output is where the two numbers actually sit adjacent.
- **`website/src/docs/concepts.md`** — a short user-facing version next to the
  existing "a build isn't done at 100% native" paragraph, pointing at
  `transtyle diff` as the right comparison.

## Left open

Two coverage notes are stale in the direction of understating the catalog, both
the same defect class the earlier chase corrected once for
`$btn-close-disabled-opacity` (a note naming the wrong reason):

- `$display-font-sizes` — says "no IR concept of display sizes"; `type.role.display.{sm,md,lg}` resolves to 1.953/2.441/3.052rem
- `$grid-breakpoints` — says "breakpoints are a known IR catalog candidate"; `semantic.breakpoint.*` ships, six rungs, resolving

Neither is bindable as-is (Bootstrap's ladders disagree — 6 display rungs at
2.5–5rem vs our 3 at 1.95–3.05rem; 5 of 6 breakpoints differ, and rebinding
would move every responsive boundary in the framework), so the classification is
right and only the stated reason is wrong. They belong in the same bucket as
AL2's size-ladder deferral: _both sides have the concept, they disagree on the
rungs_. Not fixed here — this pass was scoped to recording the asymmetry.

`check:all` green at 63.
