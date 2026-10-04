# Authored composites reached the exporters unparsed

Issue [#26](https://github.com/transtyle/transtyle/issues/26). A design system
that authors its own elevation shadow, the way the docs list
`elevation.1..4.shadow` as authorable, got this from css-variables, with no
diagnostic:

```css
--elevation-1-shadow: 0px 2px 8px 0px oklch(NaN NaN NaN); /* shadow */
```

## The defect

NORMALIZE parsed one type: a top-level `color` token became OKLCH, everything
else was carried as authored. That is right for a dimension (`0.5rem` stays
`0.5rem` on purpose) and wrong for a composite, whose members have types of their
own. `shadow.color` arrived at the exporter as the string `"#00000033"`, and
`formatColor()` read `.l`/`.c`/`.h` off a string.

Nothing could see it, for two reasons:

- **Every composite the checks ever compiled was derived.** DERIVE builds the
  shadow ladder and the type roles with their members already in IR form, and no
  example authors a composite. `check:minimal-ds` sweeps sparse design systems,
  and its whole point is authoring _less_; a composite is authoring more.
- **The leak check looked in the wrong place.** Its rule matches `undefined`,
  `null` or `NaN` right after a `:` or `=`. `oklch(NaN NaN NaN)` sits inside a
  value. The same blind spot covers `[object Object]`, which is what an authored
  `border` would have printed.

PrimeNG reads `elevation.2` and `elevation.3` for its overlays, so authoring those
levels crashed it outright (`Cannot destructure property 'l' of 'undefined'`), as
it did css-variables for the DTCG array form of `shadow`.

## The fix

`resolveComposite()` in `normalize.js` holds `shadow`, `typography`, `border` and
`transition` members to the same rules as top-level tokens:

- each member is parsed by its DTCG member type: colors to OKLCH, `inset` must be
  a boolean, dimensions and the rest stay as authored;
- a member may be an alias, resolved per mode. When it names a slot only DERIVE
  fills (`"color": "{semantic.color.scrim}"`), the composite waits like a deferred
  whole-token alias does (`pendingMembers`, honoured by DERIVE's resolve-or-fill
  so the default never overwrites it) and resolves in `resolveDeferredAliases()`;
- the members the exporters render positionally are required (`shadow`: all five
  DTCG members; `border` and `transition`: all three). A missing one used to print
  `undefined` into a stylesheet. `typography` requires nothing, because the
  engine's own type roles omit members whose source is absent;
- every failure is reported under the member's own path, all of them in one run:
  `TST1106 semantic.color.elevation.1.shadow.color: Unsupported color syntax…`,
  `TST1105 Dangling alias in semantic.color.elevation.2.shadow.0.color`. No new
  codes: both already meant "unparseable value" and "dangling alias".

A `shadow` may be an array of layers, as DTCG allows. css-variables, PrimeNG
(one shared `shadowCss()` for both of its call sites) and `explain` render it as
the comma-separated list CSS takes, with `inset`. css-variables also renders
authored `border` and `transition` composites as shorthands, and emits a
`shadow`/`border` composite per mode wherever it sits in the tree, since its
color member can vary by mode. `explain` lists an authored composite's members
and the alias each came through, recorded as `provenance.members`.

`gradient` is still carried as authored: no catalog slot or exporter consumes it.

## The guard

`check:minimal-ds` gained an authored-composite fixture compiled against all eight
exporters in light and dark: a literal shadow with a dark value, a stacked shadow
whose layers alias the derived scrim and an option color (one `inset`), a
whole-token alias to an authored shadow, a `border`, a `transition` with a
deferred alias and a four-number `cubicBezier`, and a type role with a deferred
alias. It asserts the IR (every color member is OKLCH in both modes, aliases
resolve to their targets, `provenance.members` is recorded) and the output
(css-variables lines, PrimeNG's overlays carrying the stack). A second run with
broken composites expects each error under its member path. The leak check now
also matches `NaN` and `[object Object]` anywhere on a line. `check:cli` covers
`explain` on a stacked shadow.

Reverting the source changes with the checks in place fails six assertions:
css-variables and PrimeNG throw on the fixture, and none of the four expected
diagnostics fire.
