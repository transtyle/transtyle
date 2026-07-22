---
title: "You already have a design system"
description: "The main workflow: map an existing design system's vocabulary onto the catalog without renaming anything."
order: 3
---

# You already have a design system

This is the primary use case. Your design system exists — in Figma, in Sass variables, in a brand book — with its own names and its own logic. **You do not rename anything.** You express your system in its own vocabulary, then bind Transtyle's catalog to it with one-line aliases. Five steps.

<div class="callout"><div class="callout-title">In Figma-token terms</div>

If you use primitive → alias → component token layering (Tokens Studio, Figma variables collections): your primitives go in `option.*` unchanged, your alias layer becomes custom semantic tokens under *your* names, and the binding file below is a second, tiny alias layer that only the build pipeline knows about. Your designers never see it.
</div>

## 1. Dump your raw values into `option.*`, verbatim

Your palette, your names, your structure. This tier is private vocabulary — nothing downstream depends on its shape:

```json
{ "option": { "color": { "$type": "color",
  "flame": { "$value": "#e8590c" },
  "coal":  { "900": { "$value": "#1a1614" }, "600": { "$value": "#57504b" } },
  "sand":  { "50": { "$value": "#faf6f1" }, "200": { "$value": "#eadfd3" } }
} } }
```

Paste whatever your stylesheets already contain — hex (including 4/8-digit alpha), `rgb()`/`hsl()` in either the modern or legacy comma form, and CSS named colors like `red` or `purple` all parse. OKLCH is canonical internally; conversion is automatic, so you never retype a value to satisfy the compiler.

## 2. Express your existing semantics — with *your* names

If your system already has meaning-level names ("flame is our action color", "sand is our canvas"), write them as **custom semantic tokens**. They're first-class: carried, resolved per mode, provenance-tracked:

```json
{ "semantic": { "color": { "$type": "color",
  "brand-action": { "$value": "{option.color.flame}" },
  "canvas": { "$value": "{option.color.sand.50}" }
} } }
```

Mode variants go in **separate pure-DTCG files** — the recommended layout, because every file stays readable by your existing tooling (Figma, Tokens Studio, Style Dictionary) with the mode assignment in the config, not the tokens:

```json
// tokens/dark.tokens.json — plain DTCG, only the tokens that vary
{ "semantic": { "color": { "canvas": { "$value": "{option.color.coal.900}" } } } }
```

```json
// transtyle.config.json
"tokens": [
  "tokens/*.tokens.json",
  { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

(The [inline `$extensions` form](/docs/authoring-tokens/#modes) exists too, for small hand-edited systems.)

## 3. Bind the catalog — the translation layer

One small file of aliases connects [the Transtyle language](/docs/language/) to yours. This file is *knowledge about* your system, not part of it — keep it separate, own it in the platform team:

```json
{ "semantic": { "color": { "$type": "color",
  "primary":   { "solid": { "$value": "{semantic.color.brand-action}" } },
  "elevation": { "0": { "surface": { "$value": "{semantic.color.canvas}" } } },
  "text":      { "base": { "$value": "{option.color.coal.900}" } },
  "border":    { "$value": "{option.color.sand.200}" }
} } }
```

Don't translate everything on day one. Bind what you're sure of; the coverage report will show you what derivation guessed for the rest.

## 4. Build, and read the report

```bash
npx transtyle build
```

Open `report.json` (or read the `· derived` comments in the output). Every variable is classified: what came from *your* system, what was derived from it, what was approximated. Derived values aren't wrong — they're **proposals computed from your brand**. The hover states and tinted backgrounds will already be coherent with your colors.

## 5. Tighten as trust grows

Where a derived value contradicts your system, bind it — one alias, versioned, visible. When bindings stabilize, encode policy:

```json
"derivation": { "require": ["semantic.color.primary", "semantic.color.danger"] }
```

Now a build fails if someone deletes the binding and derivation silently takes over. Your migration is done when the report's authored/derived split matches your intent — not when it hits 100% authored. Most systems settle around 40–60% authored; the rest is coherent derivation that tracks your brand automatically.

## The two mistakes to avoid

<div class="callout warn"><div class="callout-title">Practitioner warning</div>

The failures we see are never technical — they're these two, both preventable on day one.
</div>

**Don't rename your system into our catalog.** The catalog names never leak into your design language — they're the compilation interface. If your team says "flame", your tokens say "flame" forever. **Don't bind by name similarity.** Your "secondary" and shadcn's `--secondary` and Bootstrap's `$secondary` are three different concepts that happen to share a word — bind by *meaning*, and read [the language reference](/docs/language/#false-friends) before assuming. The [Cathode example](/docs/examples/#cathode--the-hostile-example) runs this whole playbook against a maximally alien system, with file layout included.
