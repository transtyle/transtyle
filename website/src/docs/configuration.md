---
title: 'Configuration'
description: 'Every field of transtyle.config.json.'
order: 5
---

# Configuration reference

One file: `transtyle.config.json`, in your project root. It's the **only** Transtyle-specific file in a project — everything else is standard DTCG. Config is data: no `transtyle.config.ts`, by design (introspectability, portability, determinism).

The `$schema` line at the top is a real, published [JSON Schema](https://transtyle.dev/schemas/config/v0.json) — editors that honor it give you autocomplete and inline validation as you type. The compiler validates the same schema at load time: an **unknown or mistyped key is an error** (`TST1010`), never silently ignored, and each target's `options` are checked against the selected exporter's own schema (`TST1011`) — so a wrong `era` or a stray option fails the build with the exact path, rather than being dropped without warning.

Full annotated example:

```json
{
  "$schema": "https://transtyle.dev/schemas/config/v0.json",
  "name": "acme-design-system",
  "tokens": [
    "tokens/base.tokens.json",
    { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } },
    "tokens/bindings.tokens.json"
  ],
  "modes": {
    "color-scheme": { "values": ["light", "dark"], "default": "light" }
  },
  "derivation": {
    "rules": "standard@1",
    "autoDark": false,
    "require": ["semantic.color.primary"]
  },
  "targets": {
    "shadcn": { "output": "dist/shadcn", "options": { "era": "tailwind-v4" } },
    "shadcn-v3": {
      "exporter": "shadcn",
      "output": "dist/shadcn-v3",
      "options": { "era": "tailwind-v3" }
    }
  },
  "check": {
    "failOn": "error",
    "contrast": { "standard": "wcag21-aa" }
  }
}
```

## `name`

Used in generated file headers and usage docs. Pick something stable; it's your design system's identity in every artifact.

## `tokens` — ordered layers

Think of the layers as **transparent sheets stacked on a lightbox**: each one can only add to or paint over what's below it, and you read the stack from the top. Later entries win.

Each entry is a glob string (base layer) or `{ "files": glob | [globs], "mode": { dimension: mode } }` (mode-scoped layer, a pure DTCG file whose values apply to one mode). Globs support single `*` segments (`tokens/*.tokens.json`); matched files load in sorted order for determinism.

Worked example. Three files, in this order:

```json
"tokens": [
  "tokens/option.tokens.json",
  "tokens/semantic.tokens.json",
  { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

| File                   | Contains                                                 | Effect                                                                             |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `option.tokens.json`   | `option.color.blue.500 = #3b5bdb`                        | A raw value. Nothing binds to it yet.                                              |
| `semantic.tokens.json` | `semantic.color.primary.solid = {option.color.blue.500}` | Binds meaning to the raw value — this is the alias that makes it your brand color. |
| `dark.tokens.json`     | `semantic.color.text.base = #f8f9fa`                     | Applies **only** in dark mode. Light mode keeps whatever the base layers said.     |

The mode-scoped layer never has to repeat anything: it lists only the tokens that genuinely differ in that mode, which on a real design system is usually a handful of neutrals. Everything else — including every derived value — recomputes per mode from what's underneath.

| Rule                                         | Diagnostic                   |
| -------------------------------------------- | ---------------------------- |
| Glob matches nothing                         | `TST1001` warning            |
| Token defined twice across base layers       | `TST1103` warning, last wins |
| Mode value overrides an earlier one          | `TST1108` warning            |
| Mode value for a token with no default value | `TST1107` warning, skipped   |
| Mode not declared in `modes`                 | `TST1109` error              |

## `modes`

Declares the **axes your design system varies along**. Each dimension lists its values and names a default; the compiler resolves every _combination_ of them.

`default` names your design system's **native** mode — the one plain `$value`s describe. It does not reorder exporter output: exporters bind mode _names_, so a dark-native system still gets shadcn's light-first structure. See [Weird things](/docs/diagnostics/#my-dark-native-system-comes-out-light-first) for why.

Worked example — the [Acme example](/docs/examples/) declares two dimensions:

```json
"modes": {
  "color-scheme": { "values": ["light", "dark"], "default": "light" },
  "density":      { "values": ["comfortable", "compact"], "default": "comfortable" }
}
```

which resolves to four full token maps: `light+comfortable`, `light+compact`, `dark+comfortable`, `dark+compact`. Every derived value is computed independently in each one — a dark-mode hover state darkens or lightens according to _that_ combination, not by translating the light-mode answer.

Two constraints worth knowing:

- **One dimension per layer.** A mode-scoped token file targets `{ "color-scheme": "dark" }`, never two axes at once (`TST1110`). Compose combinations from single-axis layers; that is what keeps "which file set this value?" answerable.
- **Exporters express what their target can express.** `color-scheme` maps everywhere; `density` has no Bootstrap or PrimeNG counterpart, so it appears in those reports as an honest `dropped` row naming the dimension, rather than being silently flattened.

## `derivation`

- `rules` — the rule pack, pinned with a version (`standard@1`). Pinning means upgrading Transtyle can never silently change your compiled theme.
- `autoDark` — default `false`. When off, dark-mode values you didn't author fall back to default-mode values (brand colors stay identical across modes). Deliberate: synthetic dark themes are the least trustworthy derivation class, so they're opt-in.
- `require` — tokens that must be **authored**, not derived. Build fails with `TST1202` otherwise. Use this to encode team policy ("nobody ships a derived brand color"). A color role may be named at the role (`semantic.color.primary`) or the anchor cell (`semantic.color.primary.solid`); both check the `.solid` cell, which is the one the grid is built from.
- `overrides` — per-slot derivation rules (specced, not yet implemented; today, simply author the token — authored always wins).

Note that `require` is a **policy** knob, not the engine's own floor. `semantic.color.primary.solid` is required whether or not you list it — nothing can invent your brand color — and its absence is `TST1201`, which fires even with no `derivation` block at all.

## `targets` — instances, not just names

Each key is a **target instance**. The optional `exporter` field selects the plugin (defaults to the key), which is how one exporter runs twice with different options — e.g. shadcn in both Tailwind eras. `output` is the emit directory (relative to the config). `options` are exporter-specific; see each exporter's page.

`transtyle build` builds all instances; `transtyle build shadcn-v3` selects by instance name.

## `check`

- `failOn` — `error` (default) | `warning` | `approximation`: the diagnostic level that makes the build exit non-zero. CI teams typically tighten this over time.
- `contrast.standard` — `wcag21-aa` (4.5:1, the default) or `wcag21-aaa` (7:1); APCA is specced. Contrast checks run on text/background pairs and every derived on-color; failures are warnings (`TST2101`), never silent. The same threshold drives [`transtyle diff`](/docs/cli/)'s contrast-regression flag, so `check` and `diff` always agree on what "passing" means.
