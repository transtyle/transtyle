# Chakra's surface inventory

Issue [#166](https://github.com/transtyle/transtyle/issues/166), the follow-up the Chakra exporter
([#172](https://github.com/transtyle/transtyle/pull/172)) filed: Chakra shipped without a
checked-in surface inventory, so `check:coverage-bar` did not cover it, and nothing proved the
exporter's rows were the whole of Chakra's theming surface. The issue asked for the reconciliation
rule to be decided together with Mantine's (#156) so the two graph-shaped targets would not each
invent one; Mantine's landed first, so this one reuses it rather than adding a third shape.

## What was built

- `packages/exporter-chakra/tools/extract-surface.mjs` reads `defaultConfig` and `defaultSystem`
  from the installed `@chakra-ui/react` (3.37.0, a demo dependency) and writes
  `surface-inventory.json`: 2426 entries in eight families. The token tiers (272): every leaf of
  `breakpoints`, `tokens` and `semanticTokens`, and every leaf of `textStyles` and `layerStyles` but
  their structure; the `colorPalette` family (the default route and the eight keys read through
  it). The recipe tier (2154): every leaf of the 19 recipes and 57 slot recipes whose CSS reads a
  token, resolved with `defaultSystem.css()` and mapped back from `var(--chakra-…)` to the token.
  Hue palettes fold into `<palette>` entries, as the issue asked; so do the `sizes` that are not a
  scale of their own (spacing repeats, fractions, keywords).
- The walk that classifies an entry as set, follows or default, and the rows it becomes, moved from
  `exporter-mantine/src/surface-coverage.js` to `@transtyle/ir` (`surfaceStatus()`,
  `surfaceRows()`, `surfaceCounts()`, `SURFACE_FAMILY_ROW`). Mantine's module keeps what is
  Mantine's own (which entries its theme sets, its reasons, the no-dark rule) and its four reports
  are byte-identical before and after. `exporter-chakra/src/surface-coverage.js` is the Chakra
  side: which entries the emitted config sets, and `REASONS`, matched by id pattern.
- `scripts/check-coverage-bar.mjs` runs one rule over both targets (`GRAPH_TARGETS`): the drift
  guard, the per-family arithmetic, a named row for every default in the token tiers, the
  catch-all refused on the examples. What is new is the _derived_ family: Chakra's `recipes` and
  `slotRecipes` report a summary row only, and the check holds their default count between the
  leaves that read a named default less those the exporter sets, and all of them.
- New `meaning` keys in `catalog-meanings.json`, all open and single-source: `scale.extra-rung`
  (the rungs Chakra's scales have beyond the catalog's), `effect.blur`, `motion.keyframes`. The
  summaries of `color.named-palette` and `target.config` now name Chakra's entries too.
  `gen-catalog-signals.mjs` skips Chakra's family rows as it does Mantine's.
- `check-doc-numbers.mjs`: `<example>.chakra.<set|follow|default>`, from the same code as Mantine's.
- The exporter records which catalog slot it maps each entry from (`mapped`), so an entry left on
  Chakra's default because the design system lacks that slot names it (GOV.UK's `fonts.mono`,
  `fg.inverted`) instead of falling to the catch-all.

## Findings

- **Chakra's bare token names need the system to read them.** A recipe writes `px: "4"`,
  `h: "10"`, `borderRadius: "l2"`, `bg: "colorPalette.solid/90"`; only the CSS property says which
  category the name is in, and `h: "10"` reads `sizes.10`, not `spacing.10`. Resolving through
  `defaultSystem.css()` gets that right for free, including the shorthands (`focusVisibleRing`,
  `textStyle`) and the colour-mix opacity suffix.
- **Two traps in reading the variables back.** Negative spacing (`spacing.-1`) shares its variable
  with `spacing.1`, so a naive map recorded nearly 500 recipe references to negative steps that
  are not in the inventory; the step is what is read. And a half step's variable escapes its dot
  (`--chakra-spacing-1\.5`), which a pattern over serialized JSON missed, losing 160 leaves; the
  values are now collected from the style object directly.
- **`sizes` repeats `spacing` by value, not by reference.** `sizes.10` is 2.5rem written again, so
  the design system's space scale never reaches the heights and icon sizes recipes take from
  `sizes`. That is most of the recipe tier's defaults (323 of the 653 recipe leaves on Acme that
  read a named default read a `sizes` step); the exporter sets control heights on the recipes
  instead, as it already did. Reported `dropped` on `sizes.<step>`, with that reason.
- **The follow count is the multiplier.** 1526 of Acme's 2426 entries follow from what the config
  sets, nearly all recipe leaves reading `l2`, `colorPalette.*`, `bg.*`, `fg.*` or a spacing step:
  the routing rule (route Chakra's defaults at roles) is what reaches them, as the spec intended.

## Measured

| Example | Report rows | Set | Follow | Chakra's default |
| ------- | ----------- | --- | ------ | ---------------- |
| Acme    | 338         | 127 | 1526   | 773              |
| Cathode | 344         | 124 | 1528   | 774              |
| GOV.UK  | 336         | 122 | 1524   | 780              |
| Carbon  | 335         | 124 | 1528   | 774              |

Rows grew by about 150 per example (eight family rows, 140 to 142 named token-tier defaults, the
totals row); the measured markers on the Chakra page moved with them (Acme 189 → 338 rows, 146 →
153 native). The emitted `theme.transtyle.ts` is unchanged on all four examples.

The check was broken on purpose four ways and restored: an entry removed from the inventory (the
drift guard names it, and every example's `tokens` family count no longer matches), the recorded
version bumped to 3.36.0 (the drift guard names both versions), the reason for `tokens.blurs.*`
removed (every example fails with the entry's id and where to add the reason), and recipe leaves
forced to the default in the classifier (every example's `recipes` count falls outside its bounds).

## Deviations from the issue

- **Layer and text styles: every leaf but their structure.** The issue said every leaf. The four
  `indicator.*` layer styles are mostly positioning (`position`, `content: ""`, insets wired to
  `--indicator-*` variables): 28 leaves that are not themable values and would each have needed a
  row. A style leaf is left out when it positions an element or only wires a component-local
  variable; the leaves that carry a value (`disabled.opacity`, a literal line height) stay.
- **Recipe defaults are not named one by one.** The issue asked for no silent `unsupported`; the
  recipe tier has 633 leaves on Chakra's default on Acme, each only because a token it reads is.
  Those tokens have their named rows, and the derived-family bound makes the count checkable, so a
  leaf on the default is never silent, without 633 copies of its token's reason in the report or
  in catalog signals.
