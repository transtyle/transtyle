# The three-token fixture authored a page background nothing read

Found while fixing the one-token Bootstrap build (#23, [worklog](2026-10-05-one-token-bootstrap.md#left-out)).
`check:minimal-ds` is the check behind the homepage's "a brand color, a page
background and a text color is a legal design system, and CI compiles exactly
that one". Its three-token fixture authored `semantic.color.surface`.

## The defect

`semantic.color.surface` is not a catalog slot: the page background is
`semantic.color.elevation.0.surface`, the canvas DERIVE builds the elevation
ladder from and every exporter binds (`$body-bg`, `--background`,
`--color-base-100`, ECharts' `backgroundColor`…). A token under any other
`semantic.*` name is legal, it is how a design system keeps its own vocabulary,
so the fixture compiled without a word. The canvas stayed the engine's
`defaulted` one in every mode, and the check really guarded brand + text only.

The authored `dark` and `dim` layers had the same name, so the sweep's premise
("derivation against a genuinely different authored canvas") was not true
either: dark mode derived against the default `oklch(0.145 0 0)`, not the
authored `#101114`. Invariant 5 (each authored scheme value reaches its own
map, distinct from the others) still passed, because it read the same custom
token back. The binding-layer and composites fixtures, and `check:grid`'s bound
design system, carried the same line.

## The fix

Every fixture authors `elevation.0.surface` instead, in the base and in the
`dark`/`dim` layers, and invariant 5 reads the catalog slot. A new invariant 0
holds each fixture to what it claims: the slots it lists as anchors (`primary.solid`,
the canvas and `text.base` for three tokens; `primary.solid` alone for one) must
reach the default map as `authored`, and the canvas and text of every
mode-scoped layer must reach that mode's map as `authored`. That is the one
assertion able to tell an anchor from a silent custom token.

Whether authoring a `semantic.color.*` name outside the catalog should say
something is left to a follow-up: a blanket warning would fire on the custom
vocabulary the [adoption guide](../../website/src/docs/adopt-existing.md)
recommends, so it needs a narrower rule (a token nothing reads whose name
shadows a catalog slot) and a new diagnostic code.

## Measured

On the light/dark three-token system, before and after:

| Mode  | Canvas before                   | Canvas after          |
| ----- | ------------------------------- | --------------------- |
| light | `defaulted`, white              | `authored`, `#ffffff` |
| dark  | `defaulted`, `oklch(0.145 0 0)` | `authored`, `#101114` |

No `TST2101` either way. Verified red by restoring the old base fixture: 176
problems, every three-token run reporting the canvas `defaulted` in the default
mode and in each authored layer's mode. No example's output moves.
