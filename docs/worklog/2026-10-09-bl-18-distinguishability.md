# Colors that can't be told apart: `TST2102` and `TST2103`

Issue [#91](https://github.com/transtyle/transtyle/issues/91), backlog item BL-18. The
categorical chart palette is derived from one brand color on most systems, and the four
status roles (`success`, `warning`, `danger`, `info`) can end up identical when they are
authored or bound that way (the Miniflux dark theme in the hostile-adoption run had all four
at one value). Nothing checked either.

## What shipped

- `TST2102` (warning): entries of `palette.categorical.1-8` closer than the threshold in a mode.
- `TST2103` (warning): the `solid` colors of `success`, `warning`, `danger`, `info` and every
  role archetyped `status`, closer than the threshold or identical.
- Both live in `packages/core/src/checks.js` next to the contrast pairs, per mode, as a
  zero-dependency `deltaEOK(a, b)` on the resolved OKLCH values (raw, no gamut mapping, so the
  result is deterministic and target-independent).
- Golden cases in `scripts/check-cli.mjs`: the Miniflux shape, a shared alias, equal colors in
  two tokens, an authored palette pair, and the clean scaffold as control.

## The threshold: 0.05

Distance is the Euclidean OKLab distance, the one CSS Color 4 uses for gamut mapping, where
0.02 is its just-noticeable difference. Measured on `main` by compiling the four examples and
sweeping the derivation over every brand color (hue in 2 degree steps, L 0.30-0.90, C 0-0.30,
light and dark):

- The derived palette's closest pair is always `categorical.3` / `categorical.8` at **0.082**,
  in every example and mode. The sweep floor is 0.063 (entries 1 and 5, an out-of-gamut primary
  at C 0.30 after sRGB clipping).
- The derived status roles' closest pair over the sweep is danger / warning at **0.12**; in the
  examples it is 0.165.
- So the threshold has to stay under 0.082, or every design system warns. **0.05** is 2.5x the
  just-noticeable difference, about CIEDE2000 10 on these hues, and leaves a margin above the
  derived floor. The alternative, 0.10 (closer to what chart-palette tools ask for thin lines),
  would mean re-tuning entries 6-8 of the palette, which changes every ECharts theme and needs a
  new rule version. Not done here.

The check therefore guards **authored** values and any future change to the derivation rules; it
cannot catch a defect in today's derived palette, because there is none.

## Decisions

- **Clusters, not pairs.** Four identical colors make six pairs; the connected components of
  "closer than the threshold" give one warning per cluster per mode, naming every member.
- **A shared alias is intent.** Cathode binds both `warning.solid` and its custom `crt-amber`
  role to `{semantic.color.crt.amber}` on purpose. A pair whose two slots end at the same alias
  target (the chain followed to its end) is skipped. Equal colors in different tokens (Miniflux)
  are the accident the check exists for.
- **No config key.** The threshold is a recorded constant (`DISTINGUISHABLE_DELTA_E`);
  `check.failOn` already decides whether a warning fails CI.
- **Not in `transtyle diff`.** `contrastRegressions` reads only `CONTRAST_PAIRS`, so a new check
  does not show up in the diff. A distinguishability regression view is its own function and CLI
  rendering; it fits with the issue that widens `diff`'s regression coverage.

## The four examples

Acme, Cathode, GOV.UK and Carbon produce neither code (Cathode's shared `crt.amber` alias is the
case the skip rule exists for). No new warning to document in the examples.

## Out of scope

The danger anchor takes its chroma from the primary, so a grey or black brand derives a grey
`danger.solid`. That color is still far from the other three, so this check doesn't flag it; it
is a separate derivation issue.
