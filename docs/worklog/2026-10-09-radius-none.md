# The radius ramp never derived `radius.none`

Found while refining #37. [ir.md](../architecture/ir.md)
lists `radius.{none,sm,md,lg,xl,full}` in the shape catalog, and
[derivation.md](../architecture/derivation.md) specs the F8 ramp as "none = 0,
sm = md × 0.5, lg = md × 1.5, xl = md × 2, full = 9999px".

## The defect

`derive.js` implemented four of the five steps. When F8 was accepted
([phase0-bootstrap.md](../exercises/phase0-bootstrap.md)) the gap it closed was
Bootstrap's `$border-radius-{sm,lg,xl,pill}`, and the rule was written for those;
`none` reached the spec but not the code. No exporter read `radius.none` by
name, and css-variables only emits slots that exist, so nothing went red: the
slot was simply missing from every compile.

## The fix

DERIVE fills `semantic.radius.none` with `0` in the unit of `radius.md`
(`radius-scale(0)`, inputs `radius.md`), inside the same branch as the other
steps, so it exists exactly when they do: `radius.md` authored as a plain
dimension. The unit is kept rather than writing a bare `0` so the slot reads like
its neighbours and stays a DTCG dimension. An authored `radius.none` wins, as
for every derived slot.

`check:grid` now requires the slot in both modes on Acme, checks its value and
rule (`0rem` from `radius-scale(0)`), and compiles a two-radius design system to
check an authored `1px` survives. Verified red by removing the derive line: the
two missing-slot errors and the value check fail; the authored case passes
either way, as it should.

## Measured

Only css-variables output moves: one more `--radius-none: 0rem` declaration per
example (it is mode-invariant, emitted once). Acme goes from 466 to 467
declarations (304 to 305 distinct), 271 to 272 resolved slots per mode, 231 to
232 engine-derived; cathode, govuk and carbon each gain the same one
declaration. Bootstrap, shadcn, daisyUI, ECharts, Storybook, Radix and PrimeNG
outputs are byte-identical on all four examples. The measured markers in the
living docs and the roadmap's css-variables row follow; the launch post is
frozen, so its `acme.slots` marker is removed and its text left as published.
