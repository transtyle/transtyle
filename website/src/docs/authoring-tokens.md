---
title: "Authoring tokens"
description: "DTCG token files, aliases, tiers, modes, and the layered layout."
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

Supported `$type`s today: `color` (values: `oklch()` or `#hex`), `dimension` (explicit units: `0.5rem`, `16px`), `fontFamily` (array of family names). The full DTCG type set — `shadow`, `typography`, `duration`, `cubicBezier`, composites — is specced for the full catalog.

## Aliases

Reference other tokens with the DTCG brace syntax:

```json
{ "semantic": { "color": { "$type": "color",
  "primary": { "solid": { "$value": "{option.color.blue.600}" } } } } }
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
{ "elevation": { "1": { "surface": {
  "$type": "color",
  "$value": "oklch(0.985 0.003 255)",
  "$extensions": { "transtyle.modes": { "color-scheme": { "dark": "oklch(0.22 0.012 255)" } } }
} } } }
```

Both forms produce the identical internal representation and may be mixed; later layers win, with a warning (`TST1108`) when a mode value is overridden.

## The layered layout (recommended for teams)

The pattern the [Cathode example](/docs/examples/#cathode--the-hostile-example) demonstrates — three kinds of files, every one pure DTCG:

| Layer | Contains | Typical owner |
|---|---|---|
| Source of truth | Option palette + your native semantic vocabulary, default-mode values | design system team / design tooling |
| Mode overlays | Per-mode values for tokens that vary | design system team |
| Bindings | One-line aliases from catalog slots to your vocabulary | platform team |

```json
"tokens": [
  "tokens/cathode.tokens.json",
  { "files": "tokens/cathode.light.tokens.json", "mode": { "color-scheme": "light" } },
  "tokens/transtyle.bindings.tokens.json"
]
```

Your design system thinks in its own language (`crt.ink`, `brand.flame`, whatever is true for you); the catalog binding is knowledge *about* your system, versioned separately. Regenerating the source files from design tooling loses nothing.

## Authoring rules of thumb

- **Author meaning, not mechanics.** Give Transtyle `primary` and your neutrals; let [derivation](/docs/derivation/) produce hover states, on-colors, and tints — then override the few you disagree with, in tokens, where the override is visible and versioned.
- **Author dark values for your neutrals** (background, surface, text, border). Auto-dark derivation exists but is off by default, deliberately.
- **Prefer OKLCH.** It's the internal canonical space; authoring in it means no conversion surprises, and lightness/chroma read meaningfully.
- **A token defined twice across files warns** (`TST1103`). Don't rely on merge order for values — that's how token repos rot; use explicit layering instead.
