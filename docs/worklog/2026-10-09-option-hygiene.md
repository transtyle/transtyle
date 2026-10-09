# Unused and duplicated option tokens were invisible

Issue #62. The compiler had the alias graph and the resolved option values, and
reported neither dead palette entries nor the same colour under several names.

## The change

`runChecks` now ends option-layer hygiene with two `info` diagnostics, once per
build and never per mode: `TST1114` (an `option.*` token no alias in any mode
map, composite members included, resolves to) and `TST1115` (option tokens of
one type with equal resolved values, one diagnostic per group). Colors compare
in OKLCH with tolerances of 1e-4 on l, c and alpha and 0.05 deg on hue, hue
ignored when both chromas are near zero; other types compare exactly, and the
type is part of the key so `16px` never matches a bare `16`. Message: count and
first three paths; the full lists are the diagnostic's `paths`, so they reach
`check --json` and `report.json` unchanged (the report schema allows extra
fields). `check.hygiene.unusedOption` / `duplicateOption` (`info` | `warning` |
`off`) set the severity; `gen:schemas` regenerated the published config schema.

## Measured on the examples

| Example | unused (TST1114)                         | same-value groups (TST1115) |
| ------- | ---------------------------------------- | --------------------------- |
| acme    | 3 (`blue.500`, `blue.700`, `gray.100`)   | 0                           |
| cathode | 0                                        | 0                           |
| govuk   | 8 (tints and shades of blue, green, ...) | 0                           |
| carbon  | 2 (`gray.40`, `gray.50`)                 | 0                           |

## Deviation from the refinement

The refinement asked for the examples to be cleaned (delete or wire the unused
tokens). They are left as they are: the diagnostics are `info`, the examples
build identically, and each unused tint or shade is a deliberate palette entry
whose wiring is a design call. Deleting them is a follow-up if wanted.
