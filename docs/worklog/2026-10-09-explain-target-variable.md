# `explain --target` and the reverse lookup

Issue [#98](https://github.com/transtyle/transtyle/issues/98): `explain` walked
provenance up from a slot, and nothing went the other way, from the variable a
developer sees in a rendered page back to the slot that fed it. Built on the
refinement appended to the issue (structured coverage fields rather than parsing
labels), on `explainToken()` (#6) and on the read recording of `check --matrix`
(#95).

## What was done

- **Coverage contract.** Two optional row fields, declared in
  `report.schema.js` (published schema regenerated) and
  [validation-and-coverage.md](../specs/validation-and-coverage.md#structured-fields-slots-and-via):
  `slots` (the IR paths read, when the `slot` label isn't one) and `via` (the
  target variables followed). Without `slots`, a `slot` that is an IR path
  counts as `[slot]`: `coverageSlots()` in core is that rule, and `check
--matrix` now uses it too. plugin-kit checks both fields' shape and that every
  `slots` entry exists in the IR (`coverage-slots-exist`, with a negative test in
  `check:plugins`).
- **Exporters.** Bootstrap fills `slots` for its member rows (`… (fontSize)`)
  and transition rows (duration + easing), and `via` for its 422 mechanically
  classified rows: a chained variable's `$` refs from `surface-inventory.json`,
  and for a `var(--bs-*)` alias the Sass variable `_root.scss` sets it from
  (`$<name>`, `$body-<name>` for the five `secondary`/`tertiary`/`emphasis`
  globals, a `-rgb` twin reading the same variable; checked against
  `bootstrap@5.3.8`). A row the exporter later drops loses both fields. PrimeNG
  splits its three brace rows (form field, button root, typography) into one row
  per variable.
- **Core.** `explainVariable(result, target, variable)` and
  `slotConsumers(result, target, slot)` next to `explainToken()`; `via` is
  followed at most 6 hops, cycle-safe. `explainToken()` now follows an alias to
  its target, as its one input, without counting toward the input depth limit.
- **CLI.** `--target <t>` and `--variable <name>` on `explain` (usage errors on
  any other command), `--json` on `explain`. The target is compiled with
  `emit: false` through the same recording loader as `check --matrix`, so a slot
  the target reads with no row naming it still says "read as an input".
- **Checks.** `check:explain` covers the lookups on a hand-built result (via
  chains, cycles, missing rows, the hop limit, errors) and the alias walk;
  `check:cli` has whole-stdout goldens for both directions on Acme, the PrimeNG
  nested preset path, a dropped variable, the error cases and `--json`
  determinism.

## Measured (Acme)

- Bootstrap: of the 422 rows with `via`, 214 reach a slot. The others end at a
  variable with no row of its own: Bootstrap palette defaults the exporter
  doesn't drive (`$gray-600`, `$white`, …), or three it drives under summary
  rows (`$spacer`, `$font-size-base`, `$line-height-base`). Same counts on
  Cathode, GOV.UK and Carbon.
- PrimeNG: 349 rows → 356 (`acme.primeng.rows`).
- Slot matrix: Bootstrap's transition rows now class `semantic.duration.*` and
  `semantic.easing.*` as `approximated` instead of `input`; PrimeNG's split rows
  name `font.sans`, `type.*` and the control and button slots exactly.

## Deviations from the refinement

- **The read recording stays in the CLI.** The refinement put the lookups in
  core, and they are; the recording itself wraps the CLI's exporter loader, as
  `check --matrix` already does, so it is reused rather than moved.
- **PrimeNG's typography row was split too**, not only the two brace rows the
  refinement listed: it is the same pattern, and reverse lookups on
  `semantic.typography.fontSize` would otherwise miss.
- **Left for follow-ups**: per-variable rows for `$spacer`, `$font-size-base`
  and `$line-height-base` (today inside summary rows, so a chain to them ends
  early), and Radix's role-wildcard rows, which read nothing until they carry
  `slots`.
