---
title: "Configuration"
description: "Every field of transtyle.config.json."
order: 5
---

# Configuration reference

One file: `transtyle.config.json`, in your project root. It's the **only** Transtyle-specific file in a project — everything else is standard DTCG. Config is data: no `transtyle.config.ts`, by design (introspectability, portability, determinism).

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
    "shadcn":    { "output": "dist/shadcn",    "options": { "era": "tailwind-v4" } },
    "shadcn-v3": { "exporter": "shadcn", "output": "dist/shadcn-v3", "options": { "era": "tailwind-v3" } }
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

Each entry is a glob string (base layer) or `{ "files": glob | [globs], "mode": { dimension: mode } }` (mode-scoped layer, pure DTCG file whose values apply to one mode). **Order is semantic**: later layers win. Globs support single `*` segments (`tokens/*.tokens.json`); matched files load in sorted order for determinism.

| Rule | Diagnostic |
|---|---|
| Glob matches nothing | `TST1001` warning |
| Token defined twice across base layers | `TST1103` warning, last wins |
| Mode value overrides an earlier one | `TST1108` warning |
| Mode value for a token with no default value | `TST1107` warning, skipped |
| Mode not declared in `modes` | `TST1109` error |

## `modes`

Declares dimensions of variation. The skeleton supports exactly one dimension. `default` names your design system's **native** mode — the one plain `$value`s describe. It does not reorder exporter output: exporters bind mode *names* (a dark-native system still gets shadcn's light-first structure). See [Weird things](/docs/diagnostics/#my-dark-native-system-comes-out-light-first) for why.

## `derivation`

- `rules` — the rule pack, pinned with a version (`standard@1`). Pinning means upgrading Transtyle can never silently change your compiled theme.
- `autoDark` — default `false`. When off, dark-mode values you didn't author fall back to default-mode values (brand colors stay identical across modes). Deliberate: synthetic dark themes are the least trustworthy derivation class, so they're opt-in.
- `require` — tokens that must be **authored**, not derived. Build fails with `TST1202` otherwise. Use this to encode team policy ("nobody ships a derived brand color").
- `overrides` — per-slot derivation rules (specced, not yet implemented; today, simply author the token — authored always wins).

## `targets` — instances, not just names

Each key is a **target instance**. The optional `exporter` field selects the plugin (defaults to the key), which is how one exporter runs twice with different options — e.g. shadcn in both Tailwind eras. `output` is the emit directory (relative to the config). `options` are exporter-specific; see each exporter's page.

`transtyle build` builds all instances; `transtyle build shadcn-v3` selects by instance name.

## `check`

- `failOn` — `error` (default) | `warning` | `approximation`: the diagnostic level that makes the build exit non-zero. CI teams typically tighten this over time.
- `contrast.standard` — `wcag21-aa` today (APCA specced). Contrast checks run on text/background pairs and every derived on-color; failures are warnings (`TST2101`), never silent.
