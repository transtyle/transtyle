# A light text with no page went black on black in dark mode

Issue #29. A design system that declares `color-scheme: [light, dark]`, authors
its body text (`text.base`) with no dark value and leaves the page
(`elevation.0.surface`) to the engine compiled a dark mode with its light text
on the default dark canvas. On the two-token system `primary.solid` +
`text.base: #212529`, before this change:

```
⚠ TST2101 text.base vs elevation.0.surface is 1.2:1 in dark mode (< 4.5:1 wcag21-aa)
```

and three more `TST2101` for `text.base` on `elevation.1.surface` and
`text.muted` on both (1.1:1). Two fallback rules met in one mode: the page fell
to `default-canvas` (near-black in dark), the text carried over from light.

## Scope

The issue's refinement listed four options. Julien chose the second: on by
default, only where the page itself is unauthored. A page authored with no dark
value (the `transtyle init` scaffold's shape before #99, and the three-token
fixture) is read as the author's page for every mode and left alone: dark =
light there, readable, and `init` now scaffolds dark values (#99, interactive
init). So the rule fixes exactly the black-on-black row of the refinement's
table and nothing else.

## The rule

`swap-neutrals`, in `derive.js`, before the elevation ladder. In a
`color-scheme` value of the other polarity than the default one (dark under a
light default, light under a dark default), when:

- `elevation.0.surface` is not in the token set at all,
- `text.base` has no value of its own for that value: TST1204's carry-over test,
  no per-mode value on the slot and the resolved colour equal to the default
  combo's, so a text bound to a token with its own dark value is not touched,
- and the default text would make a page of that polarity: the `default-text`
  pick against it is white for a dark scheme, near-black for a light one,

the page takes the default mode's `text.base` (alpha forced to 1) and the text
takes the default mode's page, the default canvas. Both are `derived`, rule
`swap-neutrals@standard@1`, inputs `text.base` and `elevation.0.surface` (the
copied one first), read from the default combo.

- **A swap, not the issue's first idea, a lightness mirror.** The refinement
  measured five systems: Bootstrap 5.3, shadcn v4 (neutral and zinc) and Carbon
  White → G100 set the dark page to exactly the light text colour, Radix and
  Material 3 close to it; a mirror (`L → 1 − L`) turns a white page into pure
  black, which none of them does. With `#212529` the dark page is Bootstrap's
  own dark `$body-bg`. The contrast ratio is symmetric, so the dark pair has the
  light pair's ratio (15.4:1 here) and passes whenever light does: no separate
  clamp is needed.
- **`derived`, not `defaulted`.** The dark page follows the user's text colour,
  which is what `derived` means. The dark text is the light default canvas, a
  constant, but the rule that put it there reads the user's token set.
- **Both directions.** A dark-native system (light text, dark default) gets its
  light mode the same way.
- **Polarity guard.** A light text on the white default page (a light mode that
  already fails `TST2101`) would swap into a light "dark" page. It is left
  alone: the carried light text on the dark default canvas is readable anyway.
- **A third `color-scheme` value** of the same polarity as the default
  (`check:minimal-ds`'s `dim`) is not swapped: `isDark` keys on the value
  `dark`, as everywhere else in DERIVE.
- **Order.** The rule reads the default combo's text and computes the default
  page as the default canvas of that combo's polarity (an unauthored page is
  unauthored in every combo), so it does not depend on the order combos are
  derived in.

`TST1206` (`info`, appended after `TST1205`) says it happened, once per scheme
value: unlike `default-canvas` and `default-text`, which fill empty slots, the
swap replaces a value the user wrote, if only in a mode the user did not write
it for. Its hint gives the ratio the carried text would have had.

## Explain follows the other mode

`provenance.inputs` names paths, and `explainToken()` looked them up in the mode
being explained. For a rule that reads another mode that showed the wrong
values. `text.inverse` (`cross-mode(text.base)`) already had that bug: in Acme's
dark mode, `explain text.inverse` printed dark's `text.base` as the input of a
value copied from light's. A derived entry may now carry `provenance.inputMode`,
the combo its inputs are read from. `explainToken()` walks those inputs in that
mode and gives them a `mode`; the CLI prints it after the path:

```
semantic.color.text.base = oklch(1 0 0)  [#ffffff]
 └─ derived by rule swap-neutrals@standard@1
    inputs: semantic.color.elevation.0.surface (light) = oklch(1 0 0)  [#ffffff]
     └─ defaulted by rule default-canvas@standard@1
    inputs: semantic.color.text.base (light) = oklch(0.262 0.009 248.19)  [#212529]
     └─ authored
```

`text.inverse` records it too. Only `provenance.kind` reaches any exporter's
output or `report.json`, so no emitted byte moves.

## The catalog probe

`transtyle catalog` compiles a probe design system that authors every anchor
modeless, in light and dark, and requires every slot to be filled by the same
rule in both. It authored `text.base` and not the page, which is exactly the
swap's shape, so the probe threw (`elevation.0.surface is filled by a different
rule in light and dark`). The probe now authors `elevation.0.surface` as an
anchor too; the probe that leaves it out reads only light, where it is
`default-canvas`, so the catalog is byte-identical.

## Rule pack and ADRs

The rule pack stays `standard@1`: [ADR-0010](../adr/0010-pre-release-breaking-changes.md)
(decision 3, kept by its amendment) lets rule semantics change in place before
the first non-prerelease version, with regenerated fixtures and a worklog note;
this is that note, and no fixture moved. [ADR-0005](../adr/0005-deterministic-derivation.md)
said "Auto-dark-mode is opt-in"; it is amended to say that was about brand
colours, which still carry over (`TST1204`) whatever `autoDark` says, while the
page and text pair is not a brand decision. `autoDark` does not gate the swap.

## The checks

`check:minimal-ds` gains a `light-text` fixture (brand + `text.base`), swept
like the others over the six mode shapes, `autoDark` off and on, every
exporter. Invariant 9: in every dark combo of a light default, the page and
text are `swap-neutrals` with the expected inputs, `inputMode` and values,
`explain` follows the inputs into the light combo, the content side
(`text.muted`, `subtle`, `disabled`, `inverse`, `elevation.1.surface`,
`primary.text-strong`) exists, one `TST1206` and no `TST2101` (except in
`dark-only`, where the dark text authored for a dark-only system genuinely
fails); every other combo keeps `default-canvas` and the authored text. A
separate block checks the edges: the dark-native direction swaps, and a dark
value on the slot, a dark value on the alias target, an authored modeless page
and a light text on the white page are each left alone. `check:explain` checks
that Acme's dark `text.inverse` input is read in light.

Verified red: with the swap call commented out, 361 problems (every dark combo
of `light-text` in three shapes, ten exporters, both `autoDark` values).

## Measured

On the two-token system, light/dark: 243 resolved slots per mode and 424
css-variables declarations before and after; the dark page goes from
`oklch(0.145 0 0)` to `#212529` and the text from `#212529` to white, 1.2:1 to
15.4:1 (`text.muted` 1.1:1 to 6.7:1). Acme, Cathode, GOV.UK and Carbon compile
byte-identical on every target, `report.json` included: Acme, Cathode and
Carbon author their page, and GOV.UK is light-only.
