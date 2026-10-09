# ADR-0015: Mode combinations: combo layers, and how exporters express contrast, motion and brand

**Status:** accepted (2026-10-09)

## Context

[ADR-0009](0009-token-layering.md) made a mode-scoped layer name one dimension (`{ "color-scheme": "dark" }`), and NORMALIZE resolves each dimension independently, the last declared dimension winning when a token has values on two of them. [ir.md](../architecture/ir.md#modes) called that case "the rare pathological pair" and promised an explicit override syntax that never shipped.

Two reserved-dimension issues showed it is the common case, not a rare one:

- **`contrast` ([#50](https://github.com/transtyle/transtyle/issues/50)).** Every high-contrast palette has a light and a dark version. Material Theme Builder exports `light-high-contrast` and `dark-high-contrast`, Primer ships `light_high_contrast` and `dark_high_contrast`. With one-dimension layers, `text.muted` authored for `contrast: more` landed on the dark page in `dark + more` (1.1:1 in the probe).
- **`brand` ([#49](https://github.com/transtyle/transtyle/issues/49)).** A brand with its own dark primary is a value for `brand: globex` and `color-scheme: dark` at once.

The same probes found the CSS side of the problem: css-variables wrote one `[data-<dimension>]` block per value, computed from the light combination only, after the dark block and at the same specificity, so `dark + more` and `dark + globex` got the light values. And `check` only looked at the scheme's own combinations (`light`, `dark`), so nothing said so.

## Decision

1. **Combo layers.** A mode-scoped layer may name several dimensions: `{ "files": "tokens/dark-more.tokens.json", "mode": { "color-scheme": "dark", "contrast": "more" } }`. Its values apply only where every named dimension has the named value, and they win there over every one-dimension value. Between combo layers, the one naming more dimensions wins; on a tie, the later layer. Each named dimension and value must be declared (`TST1109`); a layer naming none is `TST1110`. The inline `$extensions.transtyle.modes` form gets no combo syntax: a combination is a file of its own, which keeps "which file set this value" answerable.
2. **The ambiguity is reported.** A token with values on two non-default dimensions and no combo value for that combination still takes the later dimension's value (unchanged behavior), and now raises `TST1125`, naming the combinations and the layer to write.
3. **Authored always wins under `contrast` and `motion`.** The two new derivation rules only fill what DERIVE fills anyway: `contrast-more` re-runs the contrast walks against 7:1 and mixes the content ladder only as far as 7:1 allows; `motion-reduced` makes every unauthored duration `0ms`. A value carried over from the default mode is authored and stays; `check` measures every `contrast: more` combination at 7:1 and says which authored value falls short.
4. **Two exporter encodings for a dimension beyond `color-scheme`**, shared through `@transtyle/ir`:
   - **selector-per-value** (`modeBlocks`): CSS targets add a block per non-default value (`[data-contrast="more"]`) and one per combination whose values the separate blocks would get wrong (`.dark[data-contrast="more"]`). Each block holds only the declarations the cascade of the blocks before it would get wrong, so a dimension that changes no color (density) adds nothing for its dark combinations. `contrast` and `motion` values that a media feature describes are written a second time inside `@media (prefers-contrast: more)` / `@media (prefers-reduced-motion: reduce)`, guarded by `:not([data-contrast])`, so the OS setting applies until the page sets the attribute and any explicit value wins.
   - **file-per-value** (`emitPerValue`): targets with no runtime axis (Bootstrap's Sass path, PrimeNG, Mantine, Chakra, MUI) emit their files once per value, `<file>.<value>.<ext>`; ECharts names one theme per brand and scheme; daisyUI one theme per combination.

   A target that can express a dimension neither way reports `dropped` with its reason.

## Consequences

- Every combination is authorable, and every CSS combination is checked: `check:minimal-ds` resolves each one through a small cascade (attributes, OS settings, both mixed) and compares it with the stylesheet the target writes for that combination alone.
- A design system that declares none of these dimensions compiles byte-identically: the planner adds nothing, and density keeps its block.
- `TST1110` changed meaning: it used to reject a layer naming more than one dimension; it now rejects one naming none. Codes are never renumbered, and the old meaning had no remaining use.
- The selector model assumes the attributes sit on the same element as the target's scheme selector (usually `<html>`). An island with only `data-brand` inside a dark region is not supported, and the usage files say so.
- Cost accepted: a token can now have three kinds of per-mode value (inline, one-dimension layer, combo layer), with one precedence order to learn. `explain` shows which one won (`mode: color-scheme=dark, contrast=more`).
- Not decided here: `forced-colors`, a compound inline syntax, and expressing contrast in PrimeNG, ECharts, Mantine, Chakra and MUI (each reports why it can't yet).
