# Per-target mode subsets (`targets.<t>.modes`)

Issue [#89](https://github.com/transtyle/transtyle/issues/89). Modes are declared
once for the project and every target received the whole matrix, so a light-only
Bootstrap site next to a light+dark shadcn app needed a second config or
unwanted dark blocks.

## What was built

- `targets.<t>.modes: { <dimension>: [<value>, ...] }` in the config schema
  (`npm run gen:schemas` regenerated the published file).
- Core filters at one point, in the per-target loop of `compile()`
  (`packages/core/src/target-modes.js`): the exporter receives a shallow copy of
  the normalized IR with `modes`, `modeValues`, `dimensions`, `comboDims` and
  `allCombos` restricted to the kept combos and the `modes.<value>` aliases
  rebuilt. DERIVE, the checks and `reportModeCarryOver` still run once on the
  full matrix, so no exporter changed for the filtering itself and nothing is
  derived per target. The specced pipeline already said exporters run "against
  the IR"; no ADR changes.
- `TST1308` (appended; `TST1109` is a token-layer mistake and would have blurred
  two different errors): an undeclared dimension, an undeclared value, or a
  subset without the dimension's default. Checked for every requested target
  before the first write, so one bad subset emits nothing.
- A dimension a subset cuts down to one value gets no `dropped` coverage row.
  Chosen: emit nothing for it rather than an `n/a` note carrying the kept values,
  because the target's `usage.md` already states them (core appends a "Modes in
  these files" section).

## Findings

- A single-value `color-scheme` already worked everywhere (the GOV.UK example),
  as the issue predicted; the exporters needed no change to emit less.
- Four exporters' `usage.md` described a dark mode the files did not have
  (Bootstrap, shadcn, daisyUI, css-variables, which would also have said it for
  GOV.UK). They now key that text on whether a dark mode exists.
- PrimeNG reads `normalized.modes.dark ?? light` and its preset always has a
  `dark` scheme, so a light-only subset repeats the light values there. Left as
  is and documented; dropping the key means touching every component builder.
- shadcn writes an empty `.dark {}` block without a dark mode (as it already did
  for GOV.UK). Left as is: removing it changes GOV.UK's output.
- Project-level diagnostics (contrast, carry-over) are not filtered per target.

## Deviation

The issue's acceptance named Acme with Bootstrap restricted to light. Acme's
config and goldens are unchanged: the Bootstrap demo's toggle and the demo-parity
check assume all four examples share the same modes. `check:minimal-ds` builds
that exact case from a copy of Acme instead.
