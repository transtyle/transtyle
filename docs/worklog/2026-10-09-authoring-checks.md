# Three authored values that shipped as something else, silently

Issue #93. Each case compiled without a word and shipped a value the author did
not write: an out-of-sRGB brand colour that Bootstrap and Storybook clamp to hex
with no coverage note, a 2px radius that shadcn's own offsets turn into square
`rounded-sm` and `rounded-md`, and a partly authored scale that the catalog
defaults turn upside down.

## The change

- `TST1120` (info, `packages/core/src/authoring.js`): for every `semantic.*` and
  `component.*` colour that is authored or aliased, follow the alias chain to
  the authored literal and test it with `formatHex`'s own `clamped` (±0.005 in
  linear sRGB), so the diagnostic and the exporters' `approximated` rows always
  agree. Once per source token and value, naming the slots (`slots`) and the hex
  fallback (`hex`). An alias chain that ends on a derived slot is not an
  authoring decision and is skipped; so is an option token no slot reads (#62).
- `TST1121` (warning, same module): for the ordered scales DERIVE completes
  with defaults (`ORDERED_SCALES` in `derive.js`: `space`, `type.size`,
  `size.control`, `border-width`, `breakpoint`, `duration`), an adjacent
  authored/default pair out of order (px with rem at `units.remBase`, or ms; `em`,
  `calc()` and mixed units skipped), or a group whose authored tokens are all
  outside the catalog's rung names. One diagnostic per group; the mode is named
  only when the finding does not hold in every mode combination.
- `TST2104` (info, `packages/exporter-shadcn`): `radius.md` above 0 and at most
  4px, both eras, naming the era's variables. It needed a channel: `emit()` may
  now return `diagnostics: [{ severity, code, message, hint? }]`. Core validates
  it (`info`/`warning` only; a malformed entry is `TST3001`), prefixes the
  instance name and sets `target`, so two shadcn instances report separately.
  `plugin-kit` checks the same shape (`emit-diagnostics-valid`), and
  `check:plugins` has a negative test for an `error` severity.
- `check:doc-numbers` gained a `codes` metric (rows of the diagnostics table),
  so the spec's "41 shipped `TST` codes" is guarded; it was hand-edited (24
  since August, 25 this morning) while the table grew to 34. A code added by a
  later change now fails `check:doc-numbers` until the sentence follows.

## Measured

On the `init` scaffold (`check:cli`, block "#93"): `oklch(0.7 0.3 145)` behind
`primary.solid` reports `TST1120` once with `#00c800`; `radius.md: 0.125rem`
reports `TST2104` on both shadcn instances; `space.1`-`4` at 0.5/1/1.5/2rem
reports `TST1121` naming `space.4 = 2rem` and `space.5 = 1.25rem`;
`space.sm/md/lg` reports a renamed scale. Controls stay silent: the clean
scaffold, `radius.md: 0rem`, `space.4: 1rem` alone, an unused out-of-gamut
option token.

The four examples report none of the three codes: no example authors an
out-of-gamut colour (their derived states do go out of gamut, which is not this
check), Acme authors all 13 `space` rungs and the others none, and `radius.md`
is 0.5rem (Acme) or 0 (Cathode, GOV.UK, Carbon). `check:minimal-ds` stays clean.

## Deviations from the refinement

- The refinement suggested `checks.js` or a sibling module; the checks went to
  `authoring.js`, which also took `aliasRoot` (now shared with the
  distinguishability check) so `checks.js` imports it instead of the reverse.
- `docs/specs/exporters/shadcn.md` said radius scales that don't fit get extra
  radius variables classed `approximated`. The exporter never did that; the line
  now describes what it writes and when `TST2104` fires.
- The refinement reserved `TST1116` and `TST1117`. Override layers (#152) took
  `TST1116` and vocabulary pattern rules (#161) took `TST1117` to `TST1119`
  while this branch was open, so the colour check is `TST1120` and the scale
  check `TST1121`; `TST2104` is as planned. Both rem readings follow
  `units.remBase` (#151), which landed the same day, instead of a fixed 16px.
