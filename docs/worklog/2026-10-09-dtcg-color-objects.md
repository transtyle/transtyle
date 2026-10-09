# DTCG color objects stopped the build

Issue [#25](https://github.com/transtyle/transtyle/issues/25). The DTCG color
type is an object, and it is what Figma, Tokens Studio and Penpot exports now
write:

```json
{
  "$type": "color",
  "$value": { "colorSpace": "srgb", "components": [0, 0.43, 0.84], "alpha": 1, "hex": "#026fd7" }
}
```

Transtyle rejected it with `TST1106 option.color.objblue: Not a color string`,
and no hint. For a project whose first audience is teams that already have DTCG
tokens, that is the same class of hard stop the named colors were in the
hostile-adoption run ([P4](../findings/hostile-adoption.md), audit B7).

## The fix

`parseColor()` in `packages/core/src/color.js` stays the single color entry
point, so every route a color takes already goes through it: NORMALIZE's
`resolveEntry()` (base layer, `$extensions.transtyle.modes`, mode-scoped layer
files) and `resolveComposite()` (a `shadow.color` or `border.color` member),
both through the per-type table in `values.js` that #24 added. The table's
`color` row now wraps `parseColor()` to give every color `TST1106` a hint.

- **Conversion.** Every DTCG space goes to unbounded linear sRGB, then through
  the existing OKLab matrix, now factored out of `srgbToOklch()` as
  `linearSrgbToOklch()`: one OKLab matrix in the codebase, wide-gamut colors
  keep their chroma, and `srgb` takes `srgbToOklch()` itself, the path `#hex`
  takes, so an `srgb` object and its hex are bit-identical. `lab`/`lch`/
  `prophoto-rgb`/`xyz-d50` go through Bradford D50 → D65. Matrices and
  transfer functions are the CSS Color 4 sample code, as inline constants
  (zero dependencies). `oklch`/`oklab` skip the matrices.
- **The CSS syntaxes on the same converter.** `hwb()`, `lab()`, `lch()`,
  `oklab()` and `color(<predefined space> …)` parse into the same
  `(space, components, alpha)` and through the same switch; percentages use
  CSS Color 4's reference ranges (`lab` a/b 100% = 125, `lch` C 100% = 150,
  `oklab` a/b and `oklch` C 100% = 0.4). `oklch()` moved onto it too, which
  fixes three valid forms the old regular expression rejected: `none`, an
  angle unit on the hue, a percentage chroma. The `srgbToLinear()` transfer
  function now extends to negative values by symmetry, as CSS does; inputs in
  [0, 1] are unchanged bit for bit.
- **Validation.** `colorSpace` must be one of the fourteen, `components` three
  numbers or `"none"` (0, as CSS converts a missing component), `alpha` a number
  in [0, 1] (stricter than the string forms, which clamp: the object form is
  machine-written, so an alpha of 2 is a broken producer), `hex` six digits.
  Each failure is `TST1106` naming the token, or the member path in a
  composite. Out-of-range components are accepted (the spec leaves `lab`
  a/b and `xyz` unbounded); lightness and chroma clamp at 0, as in CSS.
- **`hex`.** As decided on the issue's refinement (option b): for `srgb`, a `hex`
  within 0.01 per channel of the components wins, so a two-decimal export
  ships the color the designer saw; further off, the components win and
  `TST1123` (warning, the next free code: `TST1113` was taken by the tier
  check meanwhile) names both. Outside `srgb` the `hex` is the fallback the
  spec calls it. The warning goes through a new optional `onWarning` callback
  on `parseValue()`/`parseColor()`; NORMALIZE prefixes the token or member path.
- **Provenance.** The entry already keeps `rawValue`; `transtyle explain`
  prints it for an object-form color (`└─ authored as {"colorSpace":…}`), and
  `TST1120` shows the object instead of its OKLCH rewrite. `report.json` is
  unchanged.

## What was measured

Before the change, the four examples were built and saved; after it, with
GOV.UK's brand `#1d70b8` rewritten as an `srgb` object (exact components
`n/255` and its `hex`) and Cathode's `option.color.phosphor.green` as an
`oklch` object, all four `dist/` trees are byte-identical to the ones `main`
builds.

## The guards

- `check:color` reads sRGB red in each of the fourteen spaces from values
  published by an independent implementation of the CSS Color 4 conversions
  (rounded to 4–5 decimals), and requires `#ff0000` within 1/255 and red's
  OKLCH within 0.001; the same for eleven CSS strings in the new syntaxes, the
  `hwb` gray rule, display-p3 red outside sRGB, the srgb/hex and oklch/
  `oklch()` bit identity, the hex rule both ways, and fifteen malformed inputs.
  The `lab(50% 40 59)` line that asserted a throw now passes. Breaking one P3
  matrix entry and the Lab `b` divisor fails it fifteen times.
- `check:minimal-ds`'s object-form twin now authors colors in five spaces
  (srgb with two-decimal components and a hex, a per-mode srgb value, an oklch
  option reached through an alias, lab, hwb, display-p3 outside sRGB, a shadow
  member with alpha) against their CSS strings: byte-identical on every
  exporter, `TST1120` in both twins, the object shown in the object twin's.
  Six malformed color values fail with `TST1106`, and a disagreeing `hex`
  warns `TST1123` at the top level and as a `border.color` member. Making the
  hex never win fails the twin on every exporter.
- The plugin-kit `object-form` fixture and its twin author three colors in
  object form (srgb with a hex, a per-mode oklch, display-p3), so
  `check:plugins` holds third-party plugins to the same identity.
- `check:cli` runs `explain` on a display-p3 object.

## Out of scope

Writing the object form back out belongs to the resolved-DTCG exporter
([#68](https://github.com/transtyle/transtyle/issues/68)), whose round-trip
acceptance will then cover both directions.
