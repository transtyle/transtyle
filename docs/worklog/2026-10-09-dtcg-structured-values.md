# DTCG structured values reached the exporters as `[object Object]`

Issue [#24](https://github.com/transtyle/transtyle/issues/24). A `dimension`
authored in the form the DTCG format specifies,
`{ "$type": "dimension", "$value": { "value": 16, "unit": "px" } }`, compiled
green and came out of six targets as

```css
--radius-md: [object Object];
```

Storybook and ECharts dropped the value instead, and an object-form `radius.md`
broke the derived radius scale with a `TST1105` that pointed at nothing the
author had written.

## The defect

NORMALIZE parsed one type: a top-level `color` token became OKLCH, everything
else was carried as authored. Carrying a CSS string as authored is right
(`0.5rem` stays `0.5rem` on purpose, see
[ir.md](../architecture/ir.md#values-and-canonicalization)); carrying a
JavaScript object or array is not, because every exporter stringifies what it
gets. The same class covered the `cubicBezier` array form (`[0.2, 0, 0, 1]` came
out as `0.2,0,0,1`) and the `fontWeight` keyword vocabulary DTCG defines and CSS
does not (`semi-bold` went into stylesheets as is).

Nothing could see it, for the same two reasons as the authored composites
([2026-10-04](2026-10-04-authored-composites.md)): no example or check fixture
authored a structured value, and the leak check looked only right after a
colon, where `[object Object]` does not sit once a value has a prefix.

## The fix

A per-type parser table in `packages/core/src/values.js`, called from
`resolveEntry()` in `normalize.js` (the one place a raw `$value` becomes
`entry.value`, so base values, per-mode values, mode-scoped layers and aliases
all go through it):

- `dimension` and `duration` accept the DTCG object (`px`/`rem`, `ms`/`s`) and
  become the CSS string; `cubicBezier` accepts the four-number array and becomes
  `cubic-bezier(x1, y1, x2, y2)`; a `fontWeight` keyword CSS does not know
  becomes its number, the ones CSS shares (`normal`, `bold`) stay as authored.
  Numbers are written exactly, without exponent notation.
- The canonical form is the **CSS string**, not a structured `{ value, unit }`:
  the radius scale in DERIVE, the unit-converting exporters and every
  third-party plugin tested on the plugin-kit fixture already read the string,
  so the IR value contract exporters see does not move, and both authoring
  forms compile byte-identical by construction.
- A value no CSS string can come out of (a bare non-zero number, a missing or
  unknown unit, a string where a number belongs, three bezier points, an unknown
  keyword) is `TST1106` with a hint naming the accepted forms. A bare `0`
  dimension still passes: unitless zero is valid CSS.
- Composite members go through the same table: `resolveComposite()` (from the
  composites fix) hands each member to `parseMember()`, which now dispatches by
  the member's DTCG type into `parseValue()`, so a `shadow.blur` or a
  `transition.timingFunction` is held to the same rules as the top-level token,
  reported under the member's own path. One table, two entry points.

## The guard

`check:minimal-ds` compiles an object-form twin of a design system against its
string twin on all eight exporters: every parsed type, a density-mode value, an
alias, a typography composite with structured members and an exponent-sized
number, 23 files byte-identical. It then checks eight malformed top-level
values and two malformed composite members each raise `TST1106` naming the
token (or member path), the type and a hint. The plugin-kit fixture authors its
radius, a duration and an easing in the structured form, and `check:plugins`
asserts they reach exporters as CSS strings, so conformance runs prove a plugin
never sees `{ value, unit }`. Cathode authors `radius.md` in the object form.

Reverting `normalize.js` to carry those values as authored fails the twin on all
eight exporters and the fixture check on all three values.
