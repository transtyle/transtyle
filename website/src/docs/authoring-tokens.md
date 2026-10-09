---
title: 'Authoring tokens'
description: 'DTCG token files, aliases, tiers, modes, and the layered layout.'
order: 4
---

# Authoring tokens

Token files are **valid W3C Design Tokens (DTCG)** documents. Any DTCG-aware tool can read them; Transtyle-specific syntax lives in the config manifest or the namespaced `$extensions`, both of which other tools safely ignore.

## The basics

A token is a node with `$value`; groups may declare `$type` for their children:

```json
{
  "option": {
    "color": {
      "$type": "color",
      "blue": { "600": { "$value": "oklch(0.55 0.18 255)" } }
    }
  }
}
```

Supported `$type`s today: `color` (values: `oklch()`, `#hex` incl. 4/8-digit alpha, `rgb()`/`rgba()`, `hsl()`/`hsla()`, CSS named colors, `transparent`), `dimension`, `duration`, `cubicBezier`, `fontWeight`, `number`, `fontFamily` (array of family names), and the composites `shadow`, `typography`, `border` and `transition`. Other DTCG types are carried through as authored, without type-specific parsing. `dimension`, `duration`, `cubicBezier` and `fontWeight` take either the CSS form a stylesheet would contain or the structured DTCG form:

| `$type`       | CSS form                       | DTCG form                         |
| ------------- | ------------------------------ | --------------------------------- |
| `dimension`   | `"0.5rem"`                     | `{ "value": 0.5, "unit": "rem" }` |
| `duration`    | `"150ms"`                      | `{ "value": 150, "unit": "ms" }`  |
| `cubicBezier` | `"cubic-bezier(0.2, 0, 0, 1)"` | `[0.2, 0, 0, 1]`                  |
| `fontWeight`  | `600`                          | `"semi-bold"`                     |

Dimension units are `px` or `rem`, duration units `ms` or `s`; a cubicBezier's x1 and x2 lie between 0 and 1; a DTCG weight keyword compiles to its number. Both forms compile to the same output on every target, and the same members inside `typography`, `shadow`, `border` and `transition` composites accept both too. A structured value that doesn't fit (a missing or unknown unit, a string where a number belongs, an unknown weight keyword) stops the build with `TST1106` and a hint naming the accepted forms.

A composite's members follow the same rules as top-level tokens: a color member parses like a `color` token, any member may be an alias — including to a slot the engine derives, like `scrim` — and a malformed or missing member is reported under its own path (`TST1106` on `semantic.color.elevation.1.shadow.color`). Members a stylesheet writes positionally are required, as DTCG specifies: all five of a `shadow` (`color`, `offsetX`, `offsetY`, `blur`, `spread`), and all three of a `border` (`color`, `width`, `style`) or a `transition` (`duration`, `delay`, `timingFunction`). A `shadow` may also be an array of layers, stacked first-on-top as in CSS, each with an optional `inset: true`:

```json
{
  "semantic": {
    "color": {
      "elevation": {
        "2": {
          "shadow": {
            "$type": "shadow",
            "$value": [
              {
                "color": "{semantic.color.scrim}",
                "offsetX": "0px",
                "offsetY": "1px",
                "blur": "2px",
                "spread": "0px"
              },
              {
                "color": "#00000014",
                "offsetX": "0px",
                "offsetY": "4px",
                "blur": "12px",
                "spread": "-2px"
              }
            ]
          }
        }
      }
    }
  }
}
```

`transtyle explain semantic.color.elevation.2.shadow` lists each member with the alias it came through.

## Aliases

Reference other tokens with the DTCG brace syntax:

```json
{
  "semantic": {
    "color": { "$type": "color", "primary": { "solid": { "$value": "{option.color.blue.600}" } } }
  }
}
```

Aliases resolve per mode, chain freely (semantic → semantic → option), and cycles are a hard error with the full chain printed (`TST1104`).

## Tiers

Top-level groups declare the tier: `option` (your raw palette, private), `semantic` (meaning — where exporters bind), `component` (parsed and carried, reserved for v2). Custom semantic tokens beyond the [catalog](/docs/concepts/#3-the-semantic-catalog) are welcome — see the binding pattern below.

## Modes

Two equivalent forms. **Mode-scoped layer files** are the recommended default: every token file stays pure DTCG (readable by Figma, Tokens Studio, Style Dictionary — nothing Transtyle-specific inside), and the mode assignment lives in the config:

```json
"tokens": [
  "tokens/base.tokens.json",
  { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

`dark.tokens.json` then contains plain `$value`s for whichever tokens vary. This is also the form that scales: generated files, per-mode ownership, and new dimensions (density, brand) each stay their own file.

The **inline** alternative, via the sanctioned `$extensions` mechanism, keeps a token and all its mode values in one place — convenient for small systems that hand-edit token files:

```json
{
  "elevation": {
    "1": {
      "surface": {
        "$type": "color",
        "$value": "oklch(0.985 0.003 255)",
        "$extensions": {
          "transtyle.modes": { "color-scheme": { "dark": "oklch(0.22 0.012 255)" } }
        }
      }
    }
  }
}
```

Both forms produce the identical internal representation and may be mixed; later layers win, with a warning (`TST1108`) when a mode value is overridden.

## The layered layout (recommended for teams)

The pattern the [Cathode example](/docs/examples/#cathode--the-hostile-example) demonstrates — three kinds of files, every one pure DTCG:

| Layer           | Contains                                                              | Typical owner                       |
| --------------- | --------------------------------------------------------------------- | ----------------------------------- |
| Source of truth | Option palette + your native semantic vocabulary, default-mode values | design system team / design tooling |
| Mode overlays   | Per-mode values for tokens that vary                                  | design system team                  |
| Bindings        | One-line aliases from catalog slots to your vocabulary                | platform team                       |

```json
"tokens": [
  "tokens/cathode.tokens.json",
  { "files": "tokens/cathode.light.tokens.json", "mode": { "color-scheme": "light" } },
  "tokens/transtyle.bindings.tokens.json"
]
```

Enterprise layering (core system, business-unit overlay, product overlay) redefines tokens in every layer on purpose. Mark those layers `"override": true` so the redefinitions are not reported as accidental duplicates (`TST1103`):

```json
"tokens": [
  "tokens/core.tokens.json",
  { "files": "tokens/product.tokens.json", "override": true }
]
```

An override layer that defines a token nothing earlier defined gets a `TST1116` warning (a typo is the usual cause); `"override": "extend"` allows new tokens too. `transtyle explain <slot>` prints `overrides tokens/core.tokens.json` for a token an override layer replaced. An unmarked duplicate still warns.

Your design system thinks in its own language (`crt.ink`, `brand.flame`, whatever is true for you); the catalog binding is knowledge _about_ your system, versioned separately. Regenerating the source files from design tooling loses nothing.

## Authoring rules of thumb

- **Author meaning, not mechanics.** Give Transtyle `primary` and your neutrals; let [derivation](/docs/derivation/) produce hover states, on-colors, and tints — then override the few you disagree with, in tokens, where the override is visible and versioned.
- **Author dark values for your neutrals** (background, surface, text, border). Auto-dark derivation exists but is off by default, deliberately.
- **Prefer OKLCH.** It's the internal canonical space; authoring in it means no conversion surprises, and lightness/chroma read meaningfully.
- **A token defined twice across files warns** (`TST1103`). Don't rely on merge order for values — that's how token repos rot; use explicit layering instead: a layer that redefines tokens on purpose is marked `"override": true` in the [`tokens` manifest](/docs/configuration/#override-layers), and then warns about nothing.
