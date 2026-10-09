# A config-level `rem` base for unit conversion

[#86](https://github.com/transtyle/transtyle/issues/86). [ir.md](../architecture/ir.md)
specced "a config-level `rem` base to replace that constant", and the code still had
two bases: ECharts multiplied by a literal 16 and Storybook took a per-target
`options.remBase`. A system with another root font size (GOV.UK's 62.5 % trick,
enterprise systems at 14px) got wrong pixels in every non-CSS target.

## What changed

- **Config**: top-level `units.remBase`, a string with a `px` unit (`"16px"`, default).
  Placement and format follow the answer recorded on the issue: the issue's
  `values.remBase` had no `values` section to live in, and a string with its unit
  reads like every other dimension in a config or token file. The schema pattern
  rejects `"abc"`, `"0px"`, `"100%"` and a bare number as `TST1010`; `validate.js`
  gained the `pattern` keyword for it (a standard keyword, so the published
  schema stays real JSON Schema).
- **Core**: `ctx.units` (`remBase`, `toPx`, `toRem`), from `makeUnits(config)`
  in `packages/core/src/units.js`, also exported for exporter authors. Both
  helpers return `undefined` for anything but a `px`/`rem` dimension so each
  exporter keeps its own fallback; they return unrounded numbers and the
  exporter rounds, as before.
- **ECharts** converts through it and its `approximated` note prints the base.
- **Storybook** uses it, with `options.remBase` kept as a per-target override
  (the alternative, dropping the option, would break configs for no gain
  while the two can coexist).
- **plugin-kit**'s conformance context carries `units` like core's.

## Not done, on purpose

The issue also listed Bootstrap, PrimeNG and "the JS exporter". None converts
`rem` to px (Bootstrap and PrimeNG emit the authored unit, there is no JS
exporter), so there was nothing to switch. `explain` shows provenance rather than
exporter output, so it has no converted values to annotate; the coverage note in
`report.json` is where the base is named.

## Checks

`scripts/check-rem-base.mjs` (in `check:all`): a `10px` base gives 5 for `0.5rem`
in both exporters with the base named; omitting the key and writing `"16px"` emit
identical files and coverage; `options.remBase` still wins; the invalid values
are `TST1010`. All four examples build byte-identical at the default.
