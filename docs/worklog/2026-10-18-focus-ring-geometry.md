# The focus ring's width and offset

Issue [#167](https://github.com/transtyle/transtyle/issues/167), the decision proposal 0002 row 8
had deferred: a five-field focus-ring composite "if a second component-heavy exporter (MUI, Chakra)
independently needs the same 5 fields". Chakra (#73) and then MUI (#71) met the trigger with four
of the five, and the maintainer picked two sibling scalars, no composite. The evidence and the
decision are the [amendment to proposal 0002](../proposals/0002-component-theming-primeng.md#amendment-2026-10-18-row-8-decided-a-ring-width-and-a-ring-offset-no-composite).

## What was built

- `derive.js`: `semantic.ring.width`, `alias(border-width.medium)` (2px unless the border scale is
  authored), and `semantic.ring.offset`, a catalog default of 2px. The names follow the catalog's
  concept groups (`elevation.N.surface`, `component.tooltip.max-width`): `ring` is already the word
  for the focus indicator (`color.ring`, shadcn's `--ring`), and the geometry is not a colour, so it
  is its own group, like `radius` and `border-width`. The catalog is 266 slots (259 semantic).
- `@transtyle/ir`: `isAuthored(map, path)`, the one definition of "the design system authored it"
  for exporters that write a slot only then: `authored` or `aliased`, or an `alias(<slot>)` default
  of a slot the design system authored. It is the rule the Chakra component tier had privately.
- PrimeNG `focusRing.width` / `.offset`, Chakra `--focus-ring-width` / `--focus-ring-offset` on
  `<html>`, MUI `focusVisible.outlineWidth` / `.outlineOffset`, Bootstrap `$focus-ring-width` (Sass)
  and `--bs-focus-ring-width` (CSS path), each written only when authored, with a `native` row; an
  unauthored slot is a `dropped` row that says what the target's own value is and what to author.
  Bootstrap's offset is `dropped` (a halo has no gap); Mantine, daisyUI, Radix and shadcn report both
  `dropped`. css-variables writes `--ring-width` and `--ring-offset` by construction.
- MUI's `focus.ring-composite` meaning is `promoted`; its `outlineStyle` row is the new
  `focus.ring-style`, `rejected`.
- GOV.UK authors `option.measurement.focus-width` (3px, its `$govuk-focus-width`) and binds
  `ring.width` to it. Specs, site pages, `language.md`, `derivation.md`, `ir.md`, the token schema,
  the slot matrix and the catalog-signals page follow.

## Decisions

- **Only when authored**, through the chain. A design system that authors `border-width.medium` and
  nothing about its ring gets that width on every outline target, which is what the alias default
  says; one that authors neither keeps PrimeNG's 1px, Chakra's 2px, MUI's 2px and Bootstrap's .25rem.
  The alternative, "authored on the slot itself", would have let the same design system get the
  catalog's width in css-variables and each library's own everywhere else.
- **Bootstrap's spread is the width.** A 3px outline becomes a 3px halo at alpha .25: the same
  number, a different rendering, which the row says. The CSS path's `--bs-focus-ring-width` reaches
  only the `.focus-ring` helper, since Bootstrap bakes `$focus-ring-box-shadow` into its components.
- **No composite type.** DTCG's `border` has no offset, no independent source groups the fields,
  and a composite would have duplicated or re-typed `color.ring`.
- The catalog amendment restarts the "clean exporter additions" count of
  [catalog-revision.md](../plan/catalog-revision.md) (T9); the freeze itself still arms at the first
  stable release ([ADR-0010](../adr/0010-pre-release-breaking-changes.md)).

## Measured

From a fresh build against `main`: Acme, Cathode and Carbon change in css-variables only (two new
declarations). GOV.UK changes in PrimeNG (`width: "3px"`), Chakra (`"--focus-ring-width": "3px"`),
MUI (`outlineWidth: "3px"`), Bootstrap (`$focus-ring-width: 3px` and `--bs-focus-ring-width: 3px`)
and css-variables. The MUI surface keeps 132 defaults on Acme; two of them lose their meaning key
(`theme.focusVisible.outlineWidth` and `.outlineOffset` now name the slot they wait for), so the
catalog-signals page counts 15 MUI rows without a meaning instead of 13.

## Found on the way

GOV.UK's `check.suppress` entry for `TST2101` names `ring`, and the diagnostic's path is
`semantic.color.ring`, so the two warnings from #245 still print and `TST1012` reports the entry as
matching nothing. It is on `main` too and is not this change's: filed as its own fix.
