# Configuration specification

## Two-file split: manifest vs tokens

The original vision had one `ds-exporter.config.*` holding everything. We split it:

- **`transtyle.config.json`** — the build manifest: _how_ to compile (targets, modes, derivation policy, paths).
- **`tokens/**/*.tokens.json`** — the design system itself: _what_ to compile (pure DTCG superset).

Rationale: token files stay valid, portable DTCG that Figma/Tokens Studio/Style Dictionary can read and that designers' tools can write, uncontaminated by build concerns; the manifest can change freely (new target added) without touching the design system, which keeps diffs reviewable ("this PR changes the brand" vs "this PR adds a target" are different reviewers); and importers have a clean output format (token files only).

## Config is data

`transtyle.config.json` (JSON with comments/JSON5, and YAML accepted). **No `transtyle.config.ts` in v1.** Executable config would: break `explain`/introspection guarantees, make configs non-portable to future non-Node tooling and web-based viewers, reopen the determinism hole, and complicate the security story. The pressure for code-in-config usually means a missing declarative feature — we'd rather hear about it. (Revisitable in a future major if evidence demands; the loader architecture doesn't preclude it.)

## Manifest shape (v0)

Every key below is accepted by the shipped schema — this block validates clean against `config/v0`, which is checked rather than assumed:

<!-- validates: config -->

```jsonc
{
  "$schema": "https://transtyle.dev/schemas/config/v0.json",
  "name": "acme-design-system",
  "tokens": ["tokens/**/*.tokens.json"], // ordered; later files may override earlier (explicit, warned)

  "modes": {
    "color-scheme": { "values": ["light", "dark"], "default": "light" },
  },

  "bindings": [
    // optional: pattern rules that expand into plain aliases (see Binding rules)
    { "slot": "semantic.color.{role}.solid", "from": "{option.color.{role}.600}" },
  ],

  "derivation": {
    "rules": "standard@1", // pinned rule pack (see architecture/derivation.md)
    "autoDark": false,
    "require": ["semantic.color.primary"], // must be authored (or aliased), not derived, defaulted or absent; completeness:<level> requires a whole level
  },

  "units": {
    "remBase": "16px", // what one rem is worth for exporters that convert units; default 16px
  },

  "targets": {
    "bootstrap": { "output": "dist/bootstrap" },
    "shadcn": { "output": "dist/shadcn", "options": { "era": "tailwind-v4" } },
    "echarts": { "output": "dist/echarts" },
    "storybook": {
      "output": "dist/storybook",
      "options": { "previewTargets": ["bootstrap", "shadcn"] },
    },
  },

  "check": {
    "failOn": "error", // error | warning | approximation
    "completeness": "recommended", // minimal | recommended | complete: the level the authored n/m line reports on
    "suppress": [{ "code": "TST1305", "path": "scratch", "reason": "why this is fine" }], // see below
    "contrast": { "standard": "wcag21-aa" }, // future: apca
    "hygiene": { "unusedOption": "info", "duplicateOption": "info" }, // each: info | warning | off
  },
}
```

`units.remBase` is a string with a `px` unit and a positive value (`"16px"`, `"10px"`, `"14.5px"`); anything else (`"abc"`, `"0px"`, `"100%"`, a bare number) is a `TST1010` error. Exporters that convert `rem` to pixels (ECharts, Storybook) read it through `ctx.units`, and their `approximated` coverage note names the base used. Storybook's `options.remBase` (a number) stays as a per-target override. Leaving the key out is the same as `"16px"`: output is byte-identical to a config that never had it.

`derivation.require` lists tokens that must be authored or aliased; one that is derived, defaulted or absent fails with `TST1202`. A color role named at the role (`semantic.color.primary`) checks its `.solid` cell. An entry `completeness:<level>` (`minimal`, `recommended`, `complete`) expands to that [completeness level](../architecture/derivation.md#completeness-levels)'s items, per-scheme ones included, and fails each unauthored one; another `completeness:` name is a `TST1010` error. `check.completeness` only picks the level `build`/`check` summarize and `check --json` reports on (default `recommended`); it never changes the exit code ([cli.md](cli.md#check---completeness--what-to-author-next)).

Two keys an earlier draft of this page showed are **specced, and rejected today** — a config carrying either fails to load with `TST1010: unknown property`:

- `derivation.overrides` — per-slot rule overrides ([derivation.md](../architecture/derivation.md#user-defined-rules-specced--not-implemented)). Author the token instead; authored always wins.
- `targets.<t>.version` — requesting a framework version so core can select a compat profile ([versioning.md](../architecture/versioning.md)). Where a target has more than one shape, it is an explicit option today: shadcn's `era`.

Target-specific `options` are defined and schema-validated by each exporter (the exporter ships its options schema; unknown options are errors, not silent ignores). An exporter that declares none — Bootstrap, ECharts, css-variables — rejects any `options` object at all.

### Per-target mode subsets

`modes` on a target keeps only some of the project's mode values for that target: a map from a declared dimension to the subset of its values to emit. Modes stay declared once for the project and the whole matrix is still derived and checked once; the exporter then receives only the kept combinations. A dimension the subset doesn't name keeps all its values.

```jsonc
"targets": {
  "bootstrap": { "output": "dist/bootstrap", "modes": { "color-scheme": ["light"] } }, // light-only marketing site
  "shadcn":    { "output": "dist/shadcn" }                                             // light + dark
}
```

- A single-value dimension behaves exactly like a project that declares one value (the GOV.UK example): no dark block, and every exporter already guards for it.
- A dimension not declared in the project's `modes`, a value not declared for it, or a subset that leaves out the dimension's `default` is an error, `TST1308` (the default is the base every other value is expressed against). Checked once per requested target before anything is written, so one bad subset emits nothing for any target.
- A dimension narrowed by the subset is a deliberate exclusion, so it produces no `dropped` coverage row (an unnamed dimension an exporter can't express still does). Each target's `usage.md` ends with the modes its files contain.
- Project-level diagnostics are not filtered: a dark-mode contrast warning (`TST2101`) or carry-over note (`TST1204`) still fires even if every target leaves dark out, because modes are declared for the project.
- `modes` on a target whose exporter never expresses the dimension (`density` on Bootstrap) is allowed and only narrows the view. PrimeNG's preset always has a `dark` scheme; without a dark mode it repeats the light values there.

### Target instances

A `targets` key is an **instance name**, not necessarily an exporter name. The optional `exporter` field selects the plugin (defaulting to the key), so one exporter can be configured multiple times with different options — e.g. shadcn in both Tailwind eras:

```jsonc
"targets": {
  "shadcn":    { "exporter": "shadcn", "options": { "era": "tailwind-v4" }, "output": "dist/shadcn" },
  "shadcn-v3": { "exporter": "shadcn", "options": { "era": "tailwind-v3" }, "output": "dist/shadcn-v3" }
}
```

`transtyle build shadcn-v3` selects by instance name. Variant selection lives here — in reviewed, locked config — never in CLI flags, for the reproducibility reasons in [cli.md](cli.md). (Gap found while implementing the walking skeleton; the original spec assumed one instance per exporter.)

## Token layering

The `tokens` array is an **ordered list of layers** ([ADR-0009](../adr/0009-token-layering.md)). A layer is either a glob (base layer), a mode-scoped object, or an override object (`{ "files", "override": true | "extend" }`, below):

```jsonc
"tokens": [
  "tokens/cathode.tokens.json",                                              // base: source of truth, pure DTCG
  { "files": "tokens/cathode.light.tokens.json",
    "mode": { "color-scheme": "light" } },                                   // mode overlay: pure DTCG, mode assigned HERE
  "tokens/transtyle.bindings.tokens.json"                                    // bindings: pure DTCG aliases → catalog slots
]
```

This is the **recommended layout for teams whose token files are generated or owned elsewhere**: every token file stays valid, tool-ingestible DTCG; transtyle-specific syntax is confined to this manifest. Inline `$extensions["transtyle.modes"]` remains fully supported (see the Acme example) — both forms produce the identical internal representation, and may be mixed. Precedence: later layers win; overriding an existing mode value warns (`TST1108`); a mode value for a token with no default-mode value is skipped with a warning (`TST1107`); an undeclared mode errors (`TST1109`). A file matched by a mode-scoped entry is never also loaded as a base layer, whatever the order of the entries, so `"tokens/*.tokens.json"` can cover the folder that holds the overlays ([ADR-0009, amended 2026-10-08](../adr/0009-token-layering.md#amendment-2026-10-08-an-overlay-claims-its-file)). **Override layers.** `override: true` marks a layer that redefines earlier layers on purpose (core, business unit, product): a redefinition from it raises no `TST1103`, an unmarked layer still does. A token an `override: true` layer defines that no earlier layer defined raises `TST1116` (once for the layer when it is the first one); `override: "extend"` may add tokens silently. On a mode-scoped layer, `override` suppresses `TST1108`. Normalized provenance of an overridden token carries `layer` (the winning file) and `overrides` (the files it shadowed); `explain` prints them. The object form requires `mode` or `override`. See [ADR-0009, amended 2026-10-09](../adr/0009-token-layering.md#amendment-2026-10-09-explicit-override-layers). Layer _order is semantic_ — treat the manifest's `tokens` array as carefully as an import order.

## Binding rules

A binding is one alias from a catalog slot to a token of the design system's own vocabulary. For a regular vocabulary (a `brand.50…950` ramp per role, Material's `primary` / `on-primary` pairs) that is dozens of near-identical lines. The optional `bindings` array writes them as rules instead. It is data, like the rest of the manifest, and it adds nothing to the IR ([ADR-0012](../adr/0012-binding-rules.md)).

```jsonc
"bindings": [
  { "slot": "semantic.color.{role}.solid",    "from": "{option.color.{role}.600}" },
  { "slot": "semantic.color.{role}.tint",     "from": "{option.color.{role}.50}" },
  { "slot": "semantic.color.{role}.on-solid", "from": "{option.color.white}", "roles": ["primary", "danger"] },
  { "slot": "semantic.color.text.{rung}",     "from": "{option.color.ink.{rung}}" },
  { "slot": "semantic.color.elevation.{level}.surface", "from": "{option.color.surface.{level}}" }
]
```

Each rule has a `slot` (a dotted token path) and a `from` (one alias). Optional: `roles` (restrict `{role}` to a list), `required`, `description`.

**Placeholders.** Only three exist, each a whole path segment:

| Placeholder | Iterates                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `{role}`    | the built-in color roles in catalog order, then every custom role that opted into the grid with `$extensions.transtyle.role`, sorted by name |
| `{rung}`    | the text rungs: `strong`, `base`, `muted`, `subtle`, `disabled`, `inverse`                                                                   |
| `{level}`   | the elevation levels `0`–`5`                                                                                                                 |

A rule iterates only the placeholders its `slot` uses (two placeholders are the cross product). `from` may use only placeholders the `slot` uses, so every slot gets exactly one value. Any other `{name}` is `TST1117`; ramp steps such as `600` are written literally (a `{step}` placeholder that discovers the keys under a group is a later issue).

**Expansion.** LOAD appends one more base layer, after every token file, holding one plain alias per slot a rule produces. `$type` comes from the target like any hand-written alias, and mode overlays keep working because the alias resolves per mode. The IR, exporters and `diff` see ordinary aliases; `explain` prints the rule on the alias's provenance (`aliased(target, rule)`). `transtyle bindings --expand` prints that layer as a token file, to freeze it. `transtyle bind --suggest --rules` drafts rules from a project's names ([cli.md](cli.md#bind---suggest--a-first-draft-of-the-bindings)), generalizing only where the expansion gives back exactly its proposals.

**Precedence is deterministic, and explicit bindings win.**

1. A token already in a token file (an authored value or a hand-written alias) beats every rule: the rule skips that slot, silently. This is how one cell of a regular grid is overridden.
2. Between rules, the first in the array wins; the later one gets an `info` note (`TST1119`).
3. Rules apply in array order and each iterates its placeholders in the fixed order above, so the same inputs always expand to the same layer.
4. A slot whose target token does not exist is skipped silently, so a rule can be written for the whole grid and only bind what the vocabulary has. With `"required": true` a missing target is an error instead (`TST1118`). The target must be a token authored in a token file: a rule cannot point at a slot that DERIVE materializes, or at another rule's slot.

A malformed rule (unknown placeholder, `from` not a single alias, `roles` without `{role}` or naming an unknown role, a `from` placeholder the `slot` lacks) is `TST1117`.

## Token file conventions

Standard DTCG plus:

- Top-level groups define tier: `option`, `semantic`, `component` (reserved) — see [ir.md](../architecture/ir.md#the-three-tier-token-model).
- Per-mode values: either `$extensions["transtyle.modes"]` inline, or mode-scoped layers (above).
- Multiple files merge by group path; a token defined twice is a warning (override allowed only with explicit `"$extensions": {"transtyle.override": true}` on the winner — silent last-wins merging is how large token repos rot).

Example:

```jsonc
// tokens/brand.tokens.json
{
  "option": {
    "color": {
      "blue": { "500": { "$type": "color", "$value": "oklch(0.55 0.18 255)" } },
      "white": { "$type": "color", "$value": "#ffffff" },
    },
  },
  "semantic": {
    "color": {
      "primary": { "base": { "$type": "color", "$value": "{option.color.blue.500}" } },
      "surface": {
        "base": {
          "$type": "color",
          "$value": "{option.color.white}",
          "$extensions": {
            "transtyle.modes": { "color-scheme": { "dark": "oklch(0.2 0.02 255)" } },
          },
        },
      },
    },
  },
}
```

This file, with the manifest above and the standard rule pack, is a _complete, compilable design system_: everything else (hover states, on-colors, secondary, scales, shadows…) derives — with every derived value marked and explainable. That's the minimal-input promise of the vision, delivered without magic.

## Validation & DX

- Published JSON Schemas for manifest and token files (`https://transtyle.dev/schemas/config/v0.json`, `https://transtyle.dev/schemas/tokens/v0.json`; served today from the docs site under `/schemas/`) → editor autocomplete and red squiggles with zero custom tooling. The token-file schema is generated from the catalog by `npm run gen:schemas`, never hand-edited; `check:schemas` proves it current. It completes catalog slot paths and the alias strings that point at them, closes every catalog group except the ones users extend (`semantic`, `semantic.color`, `semantic.font`, `component`), and leaves custom tokens valid.
- `transtyle init` scaffolds a manifest and token files like the pair above: on a terminal it asks for the brand color, color schemes, targets, preset and layout (each also a flag), and checks the result before it exits ([cli.md](cli.md#init)).
- Diagnostics about authored tokens carry `file`, `line`, `column` and the token `path` (source maps from LOAD; derived values and config-level codes have none, see [validation-and-coverage.md](validation-and-coverage.md#source-locations)), and every diagnostic carries a stable code (`TST1042`) for suppression (`check.suppress`) and docs deep-links.
