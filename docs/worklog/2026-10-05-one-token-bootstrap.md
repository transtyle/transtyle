# Bootstrap threw on a one-token design system

Issue [#23](https://github.com/transtyle/transtyle/issues/23). A project whose
only token is `semantic.color.primary.solid` compiled on seven exporters, and
`transtyle build` stopped on Bootstrap with a bare
`✖ Cannot read properties of undefined (reading 'c')`.

## The defect

`primary.solid` is the one token whose absence is an error (`TST1201`), so a
design system that authors nothing else is legal input. With no `text.base`,
the engine has nothing to derive the content side from: `text.*` and
`neutral.text-strong` stay empty, by design (the engine gives the page
background a default canvas, but no default text color), and `border` is never
derived at all. That is the AL5
class "a slot the exporter reads can be underivable", and Bootstrap had three
places that assumed otherwise, each hidden behind the one before:

1. The `$dark` pseudo-role mixes `neutral.text-strong` toward the surface for
   its `bg-subtle` and `border-subtle`. `ctx.mix(undefined, …)` threw.
2. The CSS-variable path calls `rgbTriplet()` for `--bs-dark-rgb`,
   `--bs-body-color-rgb` and `--bs-emphasis-color-rgb`. `undefined.slice` threw.
3. `"dark"` is the last entry of each `$theme-colors-*` map, so it has no
   trailing comma, and `dropUndefined` only matched lines ending in `;` or `,`.
   `_maps.transtyle.scss` shipped `"dark": undefined` six times.

`check:minimal-ds` could not see any of it: its floor authors `text.base`.

## The fix

- The pseudo-roles' mixes return nothing when an input is absent, and
  `rgbTriplet()` passes `undefined` through, so the declaration is dropped like
  any other absent value and Bootstrap's own default stands.
- `dropUndefined` drops declarations, not lines. `renderCss` puts two or three
  declarations on a line (`--bs-dark: …;  --bs-dark-rgb: …;`); dropping the
  line took defined neighbours with it and reported only the first name. Each
  dropped declaration now gets its own `dropped` row.
- A theme-map entry with no value is not left out. These maps replace
  Bootstrap's whole map, so a missing `"dark"` key would take
  `--bs-dark-text-emphasis`, `--bs-dark-bg-subtle` and `--bs-dark-border-subtle`
  out of the compiled CSS while `.alert-dark` and `.bg-dark-subtle` still read
  them. The entry keeps Bootstrap's own variable (`"dark": $dark-text-emphasis`,
  `$dark-text-emphasis-dark` in the dark maps) and is reported as
  `$theme-colors-text.dark`, the `$map.key` form the resolution pass already
  uses for the other roles.

Output for the four examples is byte-identical before and after: every value
they read resolves, so none of the new paths runs.

## The guard

`check:minimal-ds` runs a second fixture, the one token alone, through every
invariant and mode shape, without the extra scheme layers (a mode-scoped value
for a token the base doesn't define is skipped with `TST1107`, so the
three-token fixture's dark and dim layers can't apply). Bootstrap's dropped rows
must be named by their variable, and the one-token Sass path is compiled against
the installed Bootstrap in the order `usage.md` gives, expecting the three
`--bs-dark-*` subtle/emphasis properties in the result.

Reverting the exporter with the check in place fails 13 assertions (Bootstrap
throws in every shape); reverting only the `rgbTriplet()` guard brings back the
`slice` crash; leaving the `"dark"` key out instead of keeping Bootstrap's
variable fails the Sass assertion.

## Left out

- Whether the engine should default `text.base` (a contrast pick against
  `elevation.0.surface`, like the default canvas) is a separate question: it
  changes what the engine fills and possibly the rule-pack version. The
  exporter guard is needed either way.
- The three-token fixture authors `semantic.color.surface`, which is not a
  catalog slot (the page background is `elevation.0.surface`), so it anchors
  nothing and its `elevation.0.surface` is `defaulted` too.
- A multi-target build still stops at the first exporter that throws, with no
  target name in the message.
