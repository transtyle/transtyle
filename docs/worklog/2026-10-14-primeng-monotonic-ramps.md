# PrimeNG ramps run in order from 700 to 950

PrimeNG's projected 11-step ramps (`primary` and `surface`, light and dark) were out of order at 900 on all four examples. `ramp.js` pinned 900 to the role's `text` slot, but the standard derives `text` by walking from `solid-active`, so in practice it equals `solid-active`, which is step 700. Step 800 was already a mix halfway to `text-strong`, so the lightness went 700, 800, then back to 700's value at 900, then 950.

## What shipped

- `packages/exporter-primeng/src/ramp.js` no longer pins `text` to 900. Step 900 is `mix(solid-active, text-strong, 0.75)`, classed `approximated` with slot `—`, like 800. Step 800 is byte-identical, and so are 0 to 700 and 950. Only the three 900 values per example change (six lines of each example's preset).
- 9 of 11 steps are native, two are mixed (the surface's step 0 is a tenth native step). The coverage split (driven, inherited, Aura's default) is unchanged. The GOV.UK showcase matrix row for PrimeNG goes from 70% to 69% native.
- `scripts/check-coverage-bar.mjs` now reads each example's PrimeNG preset and asserts every projected ramp is monotonic from 700 to 950, in the direction that ramp runs. Run against the old `ramp.js` it reports 12 failures (3 ramps on 4 examples); against the new one it passes.

## Before and after

oklch lightness at 700 / 800 / 900 / 950.

| Example | Ramp          | Before                    | After                     |
| ------- | ------------- | ------------------------- | ------------------------- |
| Acme    | primary       | .48 / .35 / .48 / .22     | .48 / .35 / .285 / .22    |
| Acme    | surface light | .48 / .35 / .48 / .22     | .48 / .35 / .285 / .22    |
| Acme    | surface dark  | .62 / .803 / .62 / .985   | .62 / .803 / .894 / .985  |
| Cathode | primary       | .2 / .235 / .2 / .27      | .2 / .235 / .253 / .27    |
| Cathode | surface light | .48 / .375 / .48 / .27    | .48 / .375 / .323 / .27   |
| Cathode | surface dark  | .62 / .745 / .62 / .87    | .62 / .745 / .808 / .87   |
| GOV.UK  | primary       | .465 / .309 / .465 / .153 | .465 / .309 / .231 / .153 |
| GOV.UK  | surface light | .549 / .351 / .549 / .153 | .549 / .351 / .252 / .153 |
| GOV.UK  | surface dark  | .549 / .351 / .549 / .153 | .549 / .351 / .252 / .153 |
| Carbon  | primary       | .487 / .343 / .487 / .2   | .487 / .343 / .272 / .2   |
| Carbon  | surface light | .472 / .336 / .472 / .2   | .472 / .336 / .268 / .2   |
| Carbon  | surface dark  | .612 / .789 / .612 / .967 | .612 / .789 / .878 / .967 |

## Decisions

- **Keep 800, mix 900 at 0.75.** The alternative was even thirds (800 at 1/3, 900 at 2/3), as Aura spaces them. It moves 800 too (Acme light .35 to .393). Aura 3.0.0 reads `surface.800` in 47 places and `surface.900` in 23, so the step used more often keeps its value.
- **Cathode's primary stays out of order below 700.** Its authored `primary.solid` has lightness .27, the same as `text-strong`, so `solid-hover` and `solid-active` go darker than it. Authored values win; the fix only guarantees 700 to 950 between the anchors, and the guard checks only that span.
- Proposal #39 (promoting ramp projection to the IR) describes PrimeNG as mixing only 800 and pinning 10 of 11 steps. Whichever of the two lands second carries the new table: 800 and 900 mixed, nine pinned.
