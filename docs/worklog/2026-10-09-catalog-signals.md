# The catalog's growth signal was collected by hand

Issue #94. The coverage spec called `unsupported` rows across exporters "the data
that drives semantic-catalog growth", and nothing computed it: proposals 0003 and
0004 each re-read the exporters' reports by hand.

## The change

- `report.json` coverage rows take an optional `meaning`, a dot-separated
  kebab-case key naming what an `unsupported` row is missing. Exporters declare
  it; nothing guesses it from note text. `gen:schemas` regenerated the published
  report schema.
- `docs/findings/catalog-meanings.json` registers every key with a status:
  `open`, `watch`, `disagreement`, `rejected`, `target-specific`, `promoted`.
  `disagreement` settles the question the 2026-07-27 worklog left open (a row
  where both sides have the concept and disagree is not growth signal) without a
  sixth coverage class.
- Seeding: Bootstrap's 56 rows map onto nine keys, one per shared note constant
  in `descriptors.js` plus the three singletons in `index.js`; ECharts' one row
  is `chart.series-style`. PrimeNG classifies its icon sizes as `icon.size` in
  `surface-coverage.js`, matched on the inventory path.
- `scripts/gen-catalog-signals.mjs` writes `docs/findings/catalog-signals.md`
  and, with `--check` (`check:catalog-signals`, in `check:all` and CI), fails on a
  stale page, an unregistered key, or a registered key nothing reports.
- `scripts/lib/compile-examples.mjs` is the in-process compile the generator
  reads, written to be shared with the slot × target matrix (#95).

## Measured

On the four examples: 1162 `unsupported` units (Bootstrap 56 rows, ECharts 1,
PrimeNG 1105 slots), every one identical across examples except one PrimeNG
slot Acme drives through `component.tooltip.max-width`. Ten meanings. One is
reported by two exporters: `icon.size` (Bootstrap 3 rows, PrimeNG 57 slots in 30
families), on watch per proposal 0004. 414 PrimeNG slots wait on an Aura path
this exporter doesn't drive (`form.field.*` 125, Aura's primitive palette 193);
634 keep an Aura literal and have no meaning yet.

The four candidates the issue named (field colours, size ladder, icon colours,
inverse surface) are not `unsupported` rows in any exporter: they came from
ecosystem cross-walks, so the report can't reproduce them, and its acceptance
was restated in the issue's refinement around the signals `language.md` names.

## Found on the way

PrimeNG read its slot-level classification from the preset object before
serialization, where a colour is still `{ l, c, h }`: `emittedPaths` walked into
it and recorded `primary.500.l`, so the eleven primary-ramp steps the exporter
emits counted as Aura's default. The generator re-classifies from the emitted
file and reconciles with the report's totals row, and the two disagreed by
eleven. Fixed in `emittedPaths`; Acme moves from 78 driven / 1115 Aura default
to 89 / 1104 (Cathode, GOV.UK, Carbon 88 / 1105), and the measured markers in
`validation-and-coverage.md` and `specs/exporters/primeng.md` with it.

## Deviation from the refinement

The refinement suggested reading PrimeNG's slot-level data by calling
`classifySurface()` from the script. That needs the preset object, which only
exists inside `emit`; rather than export a new entry point from the package,
the generator parses the emitted `preset.transtyle.ts` (one `key: <JSON>` per
line by construction) and the totals reconciliation guards the parse.

`language.md` no longer says every exporter classifies its target's whole
surface: only Bootstrap and PrimeNG do. The "3+ exporters" sentence in the
coverage spec now says two, as `language.md` and proposal 0003 do.
