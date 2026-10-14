# Acme declares contrast and motion

Julien's answer on [#50](https://github.com/transtyle/transtyle/issues/50) gave Acme's demo a few hand-written `contrast: more` values, and the reserved-dimensions change ([ADR-0015](../adr/0015-mode-combinations.md)) left Acme byte-identical until a follow-up added them. This is that follow-up.

## What shipped

- `examples/acme/transtyle.config.json`: modes `contrast` (`standard|more`) and `motion` (`full|reduced`), plus the two layers below. `check.contrast.standard` stays `wcag21-aa`.
- `examples/acme/tokens/option.tokens.json`: `option.color.gray.300` and `.700`, the two steps Acme's gray scale lacked.
- `examples/acme/tokens/acme.contrast-more.tokens.json` (`text.muted` → `gray.700`, `border.base` → `gray.500`) and `acme.dark-contrast-more.tokens.json`, a combo layer for `{ color-scheme: dark, contrast: more }` (`text.muted` → `gray.200`, `border.base` → `gray.400`): the fixture's values in `packages/core/test-fixtures/mode-dimensions`. `motion` is not authored: the reduced durations are derived as `0ms`.
- The css-variables, shadcn and Radix demos got a contrast and a motion toggle next to the mode toggle, in all four examples (`check:demo-parity` needs them identical), setting `data-contrast` / `data-motion` on `<html>`. Bootstrap's demo compiles the Sass path and daisyUI picks a theme by name, so they are unchanged, as are ECharts, Storybook and the four targets that drop both dimensions. The reasons are in `examples/acme/demo/README.md`.
- Every measured Acme number moved with the sixteen combinations and the new tokens (`check:doc-numbers`, `gen:matrix`, `gen:catalog-signals`); the pages that quote them follow. The dated blog post keeps its numbers and loses its marker.
- `scripts/check-fixtures.mjs` ignores the contrast, motion and brand blocks (the Phase 0 fixture is the standard pair) and probes the Storybook decorator's new `data-theme` expression. `scripts/check-minimal-ds.mjs` resolves Acme through the cascade for contrast `standard` and `more`, light and dark, and checks the authored `more` values reach the stylesheet.

## Notes

- `check` on Acme passes. Both `text.muted` and `border.base` clear 7:1 in the four combinations with the values above, with no tuning. It still warns (`TST2101`) that each role's `on-solid` is 4.6 to 5.3:1 against its `solid` under `contrast: more`: the engine already picked the best of white and near-black, so only an authored darker `solid` would fix it. Acme does not author one, which keeps the example small; the warnings are information, not a failure.
- `option.color.gray.300` is not referenced by any token yet, so `TST1114` lists it among the unused option tokens. The brief asked for it, so it stays.
- Declaring `motion` makes Bootstrap read the duration slots (`instant`, `slow`), which moved the slot matrix.
