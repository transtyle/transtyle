# ADR-0014: Tokens Studio exports load in place, in core, as a layer form

**Status:** accepted (2026-10-09)

## Context

The alpha audience is design systems that already have DTCG tokens, and the most common way they got them is Tokens Studio for Figma. Its export is DTCG-shaped but not plain DTCG: a folder of set files (or one file holding every set), `$metadata.json` for the set order, `$themes.json` where a theme lists the sets it uses and a theme group is an independent axis, its own type names (`spacing`, `fontSizes`, `boxShadow`…), unitless pixel numbers, Figma style names as font weights, percentages, math and references inside strings (`{space.base} * 2`, `rgba({color.black}, 0.5)`), color modifiers in `$extensions["studio.tokens"]`, and a legacy format with `value` / `type` and `.value` references (issue [#52](https://github.com/transtyle/transtyle/issues/52)). Loading one meant rewriting it by hand and declaring by hand which set is which mode.

[ADR-0008](0008-importers-first-class.md) says an importer emits the source format (DTCG token files) for the user to materialize and review, and the importer contract that would host one waits until after the alpha (ROADMAP, "Import scope for the alpha: DTCG only").

## Decision

A Tokens Studio export is a third form of token layer, `{ "tokensStudio": <folder or file>, "themes"?, "sets"? }`, read in core at LOAD and lowered there to the base and mode-scoped layers ADR-0009 already defines. It is not an importer: nothing is materialized, and the export stays the source of truth that designers keep syncing from Figma.

- **Themes are mode dimensions.** Each theme group maps to one declared dimension (`map`: theme → mode value), or is compiled with one theme (`fixed`). The themes mapped to every default form the base layer; each other mode value gets an overlay of the tokens that differ. Whatever that cannot express is an error, never a silently different theme: a token only a non-default theme defines, a type that changes between themes, and two groups whose combined sets differ from applying each group's overrides on its own (every combination is checked) are `TST1008`.
- **Tokens are placed under a tier per set** (`sets`, default `option`), and every reference is rewritten to the placed path; the path designers know stays in provenance (maintainer decision on #52, 2026-10-07). The three-tier model `ir.md` and the tier checks rely on is kept, and bindings stay an ordinary file after the layer (ADR-0009).
- **Structure at LOAD, math at NORMALIZE.** Types, units, weights and legacy keys are converted at LOAD. A value with math or inner references depends on other tokens that may differ per mode, so LOAD keeps it as an expression and NORMALIZE evaluates it per mode once its references resolve, with a small parser of its own (zero dependencies, no `eval`): `+ - * /`, parentheses, `roundTo`, `min`, `max`, `floor`, `ceil`, `round`, one unit per expression, `rgba(<color>, <alpha>)`. Only this layer form produces expressions, so plain DTCG strings keep their meaning.
- **What would be wrong is refused.** A color modifier is `TST1007` until it is implemented ([#182](https://github.com/transtyle/transtyle/issues/182)); an expression outside the subset is `TST1006`.

## Consequences

- An export compiles with no edit to it: the config and a bindings file are the only hand-written inputs. The fixture in `packages/core/test-fixtures/tokens-studio/` proves the lowering the same way ADR-0009 proved layering: its folder, single-file and legacy forms compile byte-identical, on every target, to the same data rewritten by hand as plain DTCG plus a mode-scoped layer (`check:tokens-studio`).
- `explain` names the set file, the set and the Tokens Studio path of a token, per mode, and shows a math token's expression; a catalog slot bound to such a token names it too.
- ADR-0008 still holds for importers. This is a deliberate exception for one format that already is DTCG in all but dialect: a materialized copy would go stale the next time a designer syncs, which is the problem ADR-0009 was written to avoid.
- Cost accepted: core now knows one third-party dialect, and follows it when Tokens Studio changes its format. The dialect lives in `tokens-studio.js` and `expressions.js`, so the rest of the pipeline sees only DTCG layers. Lowering shares nothing yet with the DTCG resolver module ([#53](https://github.com/transtyle/transtyle/issues/53)), which needs the same "contexts to layers" step: whichever lands second reuses the other's.
- Cost accepted: a design system whose theme groups interact (a set two groups both change) cannot be expressed with one override per dimension and is refused rather than approximated.
