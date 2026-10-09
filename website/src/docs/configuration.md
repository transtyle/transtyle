---
title: 'Configuration'
description: 'Every field of transtyle.config.json.'
order: 5
---

# Configuration reference

One file: `transtyle.config.json`, in your project root. It's the **only** Transtyle-specific file in a project — everything else is standard DTCG. Config is data: no `transtyle.config.ts`, by design (introspectability, portability, determinism).

The `$schema` line at the top is a real, published [JSON Schema](/schemas/config/v0.json) — editors that honor it give you autocomplete and inline validation as you type. The `transtyle.dev` URL below is the schema's permanent identifier, not a download link: that domain is not registered yet, so an editor that fetches it literally will come up empty. The identical file is served from this site at the link above, and the compiler fetches neither — it validates against its own bundled copy. The compiler validates the same schema at load time: an **unknown or mistyped key is an error** (`TST1010`), never silently ignored, and each target's `options` are checked against the selected exporter's own schema (`TST1011`) — so a wrong `era` or a stray option fails the build with the exact path, rather than being dropped without warning.

Full annotated example:

<!-- validates: config -->

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
  "bindings": [{ "slot": "semantic.color.{role}.solid", "from": "{option.color.{role}.600}" }],
  "derivation": {
    "rules": "standard@1",
    "autoDark": false,
    "require": ["semantic.color.primary"]
  },
  "units": { "remBase": "16px" },
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
    "contrast": { "standard": "wcag21-aa" },
    "hygiene": { "unusedOption": "info", "duplicateOption": "info" }
  }
}
```

## Binding rules

`bindings` is optional. A binding is one alias from a catalog slot to a token of your own vocabulary; when that vocabulary is regular (a `brand.50` to `brand.950` ramp per role), a rule writes the whole grid in one line:

```json
"bindings": [
  { "slot": "semantic.color.{role}.solid", "from": "{option.color.{role}.600}" },
  { "slot": "semantic.color.{role}.tint", "from": "{option.color.{role}.50}" },
  { "slot": "semantic.color.{role}.on-solid", "from": "{option.color.white}", "roles": ["primary", "danger"] },
  { "slot": "semantic.color.text.{rung}", "from": "{option.color.ink.{rung}}" },
  { "slot": "semantic.color.elevation.{level}.surface", "from": "{option.color.surface.{level}}" }
]
```

- `{role}` is every built-in color role plus every custom role that joined the grid with `$extensions.transtyle.role`; `roles` restricts it. `{rung}` is the text rungs (`strong`, `base`, `muted`, `subtle`, `disabled`, `inverse`) and `{level}` the elevation levels `0` to `5`. Those three are the only placeholders; write ramp steps such as `600` literally. Two placeholders in one `slot` iterate their cross product.
- `from` is a single alias and may only use placeholders the `slot` uses.
- **Explicit bindings win.** A slot you already bind in a token file (an authored value or a hand-written alias) is left alone by every rule, silently, so overriding one cell of the grid is just writing it. Between two rules, the first in the array wins and the second gets a `TST1119` note.
- A slot whose target token does not exist is skipped silently, so one rule can cover the whole grid and bind only what your vocabulary has. Add `"required": true` and a missing target is an error instead (`TST1118`). Targets must be tokens written in a token file.
- Rules expand when the config loads into ordinary aliases, so exporters and [`diff`](/docs/cli/) see nothing new, and [`explain`](/docs/cli/) names the rule behind an alias. `npx transtyle bindings --expand` prints the expansion as a token file when you prefer to freeze it, and `npx transtyle bind --suggest --rules` drafts rules from your own names.
- A malformed rule is `TST1117`: an unknown placeholder, a `from` that is not one alias, `roles` without `{role}` or naming a role that does not exist.

## Token files in your editor

Token files have a published [JSON Schema](/schemas/tokens/v0.json) too, generated from the compiler's own catalog. With it, typing inside `semantic.color.primary.` offers the sixteen grid cells, a `$value` can be completed with an alias such as `{semantic.radius.full}`, and a misspelled slot like `primary.solidd` is underlined. Scaffolded token files (`transtyle init`) carry the `$schema` line already. For an existing file, add it at the top:

```json
{
  "$schema": "https://transtyle.dev/schemas/tokens/v0.json",
  "semantic": { "color": { "primary": { "solid": { "$value": "oklch(0.55 0.18 255)" } } } }
}
```

As with the config schema, the `transtyle.dev` URL is the identifier and an editor that fetches it will find nothing yet. Until the domain exists, associate the schema with your token files in VS Code's `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/*.tokens.json"],
      "url": "https://transtyle.github.io/transtyle/schemas/tokens/v0.json"
    }
  ]
}
```

Two limits are by design. Your own tokens must stay valid, so `semantic`, `semantic.color`, `semantic.font` and `component` accept any group: a misspelled _role_ (`semantic.color.primry`) looks like a custom role and is not flagged, while everything inside a built-in role or ladder is checked. And alias completion offers the catalog as a list of strings; editors complete a string value from that list, but not in the middle of a string, and `option.*` aliases and literal values are never flagged.

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

A glob can cover the folder that holds the overlays. The overlay claims its file, so the glob skips it, whichever entry comes first:

```json
"tokens": [
  "tokens/*.tokens.json",
  { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }
]
```

`dark.tokens.json` loads once, as the dark overlay; every other file in `tokens/` is a base layer.

### Override layers

A layer that redefines tokens from earlier layers on purpose (core system, then business unit, then product) is marked with `override`:

```json
{ "files": "tokens/product.tokens.json", "override": true }
```

- `true`: redefinitions are silent. A token the layer defines that no earlier layer defined warns `TST1116` (an override that overrides nothing is usually a typo). A first layer has nothing to override, and gets one `TST1116` for the layer.
- `"extend"`: same, and the layer may also add new tokens.
- Combinable with `mode`: an override mode-scoped layer does not raise `TST1108` when it replaces an earlier mode value.
- An object entry needs `mode` or `override`; a bare `{ "files": … }` is just a string glob and fails schema validation (`TST1010`), like any other `override` value.
- `transtyle explain` and the report's provenance record the winning layer and the files it shadowed.

| Rule                                           | Diagnostic                                  |
| ---------------------------------------------- | ------------------------------------------- |
| Glob matches nothing                           | `TST1001` warning                           |
| Token defined twice across base layers         | `TST1103` warning, last wins                |
| Same, in a layer marked `"override"`           | Silent (intended override)                  |
| `"override": true` layer defines a new token   | `TST1116` warning (`"extend"` allows it)    |
| Mode value overrides an earlier one            | `TST1108` warning                           |
| Mode value for a token with no default value   | `TST1107` warning, skipped                  |
| Mode not declared in `modes`                   | `TST1109` error                             |
| File matched by a glob and a mode-scoped entry | Loaded once, as the overlay (no diagnostic) |

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

- **The first dimension carries light/dark.** Order matters: the first dimension listed is the _polarity axis_ — the one exporters bind as light/dark. So if you use `color-scheme`, list it first. Declaring it after another dimension (e.g. `density` first) would make dark mode silently never reach any exporter — the dark values still resolve into their combinations, but no target reads them, so every exporter emits a dark block filled with light values. Because that output is guaranteed wrong, Transtyle makes it a build **error** (`TST1112`), not a warning — reorder `modes` to fix it.
- **One dimension per layer.** A mode-scoped token file targets `{ "color-scheme": "dark" }`, never two axes at once (`TST1110`). Compose combinations from single-axis layers; that is what keeps "which file set this value?" answerable.
- **Exporters express what their target can express.** `color-scheme` maps everywhere; `density` has no Bootstrap or PrimeNG counterpart, so it appears in those reports as an honest `dropped` row naming the dimension, rather than being silently flattened.

## `derivation`

- `rules` — the rule pack, pinned with a version (`standard@1`). Pinning means upgrading Transtyle can never silently change your compiled theme.
- `autoDark` — default `false`. Regardless of this setting, a role's `.solid` you didn't author for a non-default `color-scheme` value falls back to the default-mode color (brand colors stay identical across modes) — deliberate, surfaced by `TST1204`. What `autoDark: true` adds today: that carry-over is classified `derived` in coverage instead of `authored`, so `report.json` shows synthetic dark-theme coverage honestly. Computing a genuinely _different_ dark color is specced but not yet implemented — an open, deliberately deferred research question (see the [roadmap](/docs/roadmap/#specced-not-yet-implemented)), not a missing wire-up. The page and body text are not covered by this setting: an unauthored page under a `text.base` with no dark value gets the light pair swapped in dark mode either way ([`TST1206`](/docs/diagnostics/#my-dark-page-is-my-light-text-color)).
- `require` — tokens that must be **authored**, not derived. Build fails with `TST1202` otherwise. Use this to encode team policy ("nobody ships a derived brand color"). A color role may be named at the role (`semantic.color.primary`) or the anchor cell (`semantic.color.primary.solid`); both check the `.solid` cell, which is the one the grid is built from.
- `overrides` — per-slot derivation rules (specced, not yet implemented; today, simply author the token — authored always wins).

Note that `require` is a **policy** knob, not the engine's own floor. `semantic.color.primary.solid` is required whether or not you list it — nothing can invent your brand color — and its absence is `TST1201`, which fires even with no `derivation` block at all.

## `units`

- `remBase` — what one `rem` is worth, as a `px` length: `"16px"` (the default). Exporters whose target wants pixels (ECharts, Storybook) convert `rem` dimensions at this base and name it in the `approximated` row of the report. Set it when your system's root font size is not 16px: GOV.UK's 62.5 % trick is `"10px"`, some enterprise systems use `"14px"`. A value that is not a positive `px` length (`"abc"`, `"0px"`, `"100%"`) is `TST1010`. Storybook's own `options.remBase` (a number) still overrides it for that target.

## `targets` — instances, not just names

Each key is a **target instance**. The optional `exporter` field selects the plugin (defaults to the key), which is how one exporter runs twice with different options — e.g. shadcn in both Tailwind eras. `output` is the emit directory (relative to the config). `options` are exporter-specific; see each exporter's page.

`transtyle build` builds all instances; `transtyle build shadcn-v3` selects by instance name.

### Per-target mode subsets

Modes are declared once for the project, but not every target needs all of them: a marketing site on Bootstrap may be light-only while the app on shadcn ships light and dark. Set `modes` on a target to keep only some values; a dimension you don't name keeps all of its values.

```json
"targets": {
  "bootstrap": { "output": "dist/bootstrap", "modes": { "color-scheme": ["light"] } },
  "shadcn": { "output": "dist/shadcn" }
}
```

That Bootstrap build emits no `data-bs-theme="dark"` block, its `usage.md` lists the modes it contains, and the other targets are unchanged. Things to know:

- **Keep the default value.** A subset that leaves out the dimension's `default`, or names a dimension or value you didn't declare in `modes`, stops the build with `TST1308` before anything is written, for every target.
- **A narrowed dimension is not a loss.** It gets no `dropped` row in `report.json`; a dimension you didn't narrow that the exporter can't express still does.
- **Project-level checks still run on everything.** A dark-mode contrast warning still fires even if every target leaves dark out, because modes are declared for the project, not per target.
- **PrimeNG always carries a `dark` scheme** in its preset; without a dark mode it repeats the light values there.

## `check`

- `failOn` — `error` (default) | `warning` | `approximation`: the diagnostic level that makes the build exit non-zero. CI teams typically tighten this over time.
- `suppress` — silence a known warning or info and say why: an array of `{ "code": "TST1305", "path": "scratch", "reason": "…" }`. `reason` is required and can't be blank; `path` is optional (an exact token path, or a prefix ending in `.*`). Suppressed diagnostics leave the printed output and `failOn`, and are listed under `suppressed` in `report.json`. Errors can't be suppressed. See [Suppressing a diagnostic](/docs/diagnostics/#suppressing-a-diagnostic).
- `contrast.standard` — `wcag21-aa` (4.5:1, the default) or `wcag21-aaa` (7:1); APCA is specced. Contrast checks run on text/background pairs and every derived on-color; failures are warnings (`TST2101`), never silent. The same threshold drives [`transtyle diff`](/docs/cli/)'s contrast-regression flag, so `check` and `diff` always agree on what "passing" means.
- `hygiene.unusedOption`, `hygiene.duplicateOption` — `info` (default) | `warning` | `off`: the severity of `TST1114` (option tokens no alias resolves to) and `TST1115` (option tokens of the same type with the same value). Both are reported once per build, with the count and the first paths in the message and the full lists in `check --json`. Set `warning` (with `failOn: warning`) to make CI refuse dead or duplicated palette entries.
