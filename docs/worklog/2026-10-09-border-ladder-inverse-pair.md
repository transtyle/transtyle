# A border ladder and an inverse pair; icon colours stay on the text ladder

Issues #31, #33 and #36, done as one change because they settle the same corner
of the catalog: the neutral content colours around `text.*`. The evidence and
the decisions are in [proposal 0005](../proposals/0005-border-ladder-inverse-pair.md);
this entry records what changed in the repository and what was measured.

## What changed

- **Catalog.** `semantic.color.border` (one leaf) became
  `semantic.color.border.{subtle, base, strong, field}`, and
  `semantic.color.inverse.{surface, text}` is new: 259 → 264 slots, 252 → 257
  semantic (`catalog()` reads them off DERIVE; the slot matrix and the token
  schema were regenerated from it). `BORDER_RUNGS`, `INVERSE_SLOTS` and
  `RENAMED_SLOTS` are exported by `@transtyle/ir`.
- **Rules.** `border.base` = `text.base` mixed 0.88 toward `elevation.1.surface`;
  `border.subtle` = `base` mixed 0.50 toward it; `border.strong` = a contrast walk
  from `base` toward `text.base` to 3:1 against `elevation.0` and `.1`;
  `border.field` and the inverse pair are aliases. `inverse.text` on
  `inverse.surface` joined `CONTRAST_PAIRS`, so `check` and `diff` both see it.
  `TST1205`'s message now lists the border ladder and `inverse.surface` among
  what a `text.base` bound too late leaves underived.
- **Migration.** The rename is in place (ADR-0010). `TST1122` (NORMALIZE, error)
  catches a token left at `semantic.color.border`; `TST1311` (LOAD, error)
  catches a token that also has children, which the loader used to drop without a
  word — the exact shape of a half-done migration, checked on a copy of Acme
  during the refinement of #31. Both codes are on the diagnostics page and in the
  validation spec. The four examples, the two plugin-kit fixtures that authored
  `border`, `transtyle init`'s scaffold, the css-variables demos
  (`--color-border-base`) and the website's gallery swatches were migrated.
- **Exporters.** Table in the proposal. The two that read more than a renamed
  slot: PrimeNG (field, card and overlay borders from the ladder instead of
  `neutral.outline`; field, list and menu icons from the text ladder; the
  `contrast` severity and an authored tooltip from the inverse pair) and Bootstrap
  (an authored inverse pair on the tooltip, per mode on both paths; the close and
  select glyphs from `text.base`). Chakra's inverted pair and `border.subtle`,
  shadcn's `--input` and Storybook's `inputBorder` read the new slots; Mantine
  and MUI say in a `dropped` row why they can't.
- **Carbon** authors the inverse pair from `$background-inverse` /
  `$text-inverse`, the authored case the defaults can't show.

## What was measured

- The ladder on the examples, light / dark: Acme `subtle` #edeff2 / #20242a,
  `strong` #8d9195 / #63676c; Cathode `strong` #7c8972 / #2f6d32; GOV.UK `strong`
  #8f8f8f; Carbon `strong` #8b8b8b / #707070, against Carbon's own
  `border-strong-01` #8d8d8d / #6f6f6f. Every `strong` lands between 3.02:1 and
  3.63:1 against the two surfaces; every authored `base` sits between 1.26:1 and
  1.61:1.
- The inverse pair's contrast: 13.6:1 to 19.6:1 on the defaults, 11.5:1 (light)
  and 16.4:1 (dark) on Carbon's authored pair.
- Emitted files, diffed against `main` on all four examples × eleven targets:
  - unchanged colours, slot names in comments and report rows only: shadcn (plus
    `--input` from `approximated` to `derived`), daisyUI, ECharts, Storybook,
    Mantine, MUI; Radix byte-identical;
  - css-variables grows by the new slots: `--color-border` becomes
    `--color-border-base`, plus `--color-border-{subtle,strong,field}` and
    `--color-inverse-{surface,text}` per mode;
  - Bootstrap gains `$btn-close-color` and `$form-select-indicator-color`
    (`text.base`); Carbon's also gains the tooltip blocks;
  - PrimeNG's borders follow the authored border, and its field, list and menu
    icons the text ladder (34 more component slots inherit the design system:
    1566 → 1600 inherited, 1104 → 1070 on Aura's default on Acme);
  - Chakra's `border.subtle` and `fg.inverted` move to the new slots.
- Doc numbers re-derived by `check:doc-numbers` (catalog counts, decls, rows, the
  coverage splits, the shadcn transcript that lost its `approximated` share, the
  GOV.UK coverage matrix); `gen:matrix`, `gen:catalog-signals` and `gen:schemas`
  regenerated.

## Deviations and what was left out

- #36 asked for an `icon.*` group. The refinement measured that every system
  naming icon colours gives them the text values, and the maintainer chose
  bindings on the text ladder with no new vocabulary (2026-10-07); the proposal
  records why, and icon colour is a watch item next to icon size.
- #33 asked for `inverse.primary` and `inverse.border` and to fold `text.inverse`
  into the group; the maintainer chose two slots and a separate `text.inverse`.
- #31 named the field border `interactive`; it is `field` (Carbon's
  `border-interactive` is its blue focus border). No field hover cell: PrimeNG's
  hover stays on `neutral.outline-hover`, so a design system that aliases
  `border.field` to `border.strong` gets a hover lighter than the rest state there.
- The PrimeNG coverage classifier counts the authored tooltip binding
  (`components.tooltip.colorScheme.*.root.*`) as inherited, not driven, because
  it matches emitted paths without the `colorScheme` segment; the binding has its
  own `native` rows in `report.json`.
