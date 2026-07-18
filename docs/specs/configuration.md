# Configuration specification

## Two-file split: manifest vs tokens

The original vision had one `ds-exporter.config.*` holding everything. We split it:

- **`transtyle.config.json`** — the build manifest: *how* to compile (targets, modes, derivation policy, paths).
- **`tokens/**/*.tokens.json`** — the design system itself: *what* to compile (pure DTCG superset).

Rationale: token files stay valid, portable DTCG that Figma/Tokens Studio/Style Dictionary can read and that designers' tools can write, uncontaminated by build concerns; the manifest can change freely (new target added) without touching the design system, which keeps diffs reviewable ("this PR changes the brand" vs "this PR adds a target" are different reviewers); and importers have a clean output format (token files only).

## Config is data

`transtyle.config.json` (JSON with comments/JSON5, and YAML accepted). **No `transtyle.config.ts` in v1.** Executable config would: break `explain`/introspection guarantees, make configs non-portable to future non-Node tooling and web-based viewers, reopen the determinism hole, and complicate the security story. The pressure for code-in-config usually means a missing declarative feature — we'd rather hear about it. (Revisitable in a future major if evidence demands; the loader architecture doesn't preclude it.)

## Manifest shape (v0)

```jsonc
{
  "$schema": "https://…/transtyle.config/v0.json",
  "name": "acme-design-system",
  "tokens": ["tokens/**/*.tokens.json"],        // ordered; later files may override earlier (explicit, warned)

  "modes": {
    "color-scheme": { "values": ["light", "dark"], "default": "light" }
  },

  "derivation": {
    "rules": "standard@1",                       // pinned rule pack (see architecture/derivation.md)
    "autoDark": false,
    "require": ["semantic.color.primary"],       // must be authored, not derived
    "overrides": { /* per-slot rules */ }
  },

  "targets": {
    "bootstrap": { "version": "5.3", "output": "dist/bootstrap", "options": { "emitSass": true } },
    "shadcn":    { "version": "latest-profile", "output": "dist/shadcn" },
    "echarts":   { "output": "dist/echarts" },
    "storybook": { "output": "dist/storybook", "options": { "previewTargets": ["bootstrap", "shadcn"] } }
  },

  "check": {
    "failOn": "error",                           // error | warning | approximation
    "contrast": { "standard": "wcag21-aa" }      // future: apca
  }
}
```

Target-specific `options` are defined and schema-validated by each exporter (the exporter manifest ships its options schema; unknown options are errors, not silent ignores).

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

The `tokens` array is an **ordered list of layers** ([ADR-0009](../adr/0009-token-layering.md)). A layer is either a glob (base layer) or a mode-scoped object:

```jsonc
"tokens": [
  "tokens/cathode.tokens.json",                                              // base: source of truth, pure DTCG
  { "files": "tokens/cathode.light.tokens.json",
    "mode": { "color-scheme": "light" } },                                   // mode overlay: pure DTCG, mode assigned HERE
  "tokens/transtyle.bindings.tokens.json"                                    // bindings: pure DTCG aliases → catalog slots
]
```

This is the **recommended layout for teams whose token files are generated or owned elsewhere**: every token file stays valid, tool-ingestible DTCG; transtyle-specific syntax is confined to this manifest. Inline `$extensions["transtyle.modes"]` remains fully supported (see the Acme example) — both forms produce the identical internal representation, and may be mixed. Precedence: later layers win; overriding an existing mode value warns (`TST1108`); a mode value for a token with no default-mode value is skipped with a warning (`TST1107`); an undeclared mode errors (`TST1109`). Layer *order is semantic* — treat the manifest's `tokens` array as carefully as an import order.

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
      "blue":  { "500": { "$type": "color", "$value": "oklch(0.55 0.18 255)" } },
      "white": { "$type": "color", "$value": "#ffffff" }
    }
  },
  "semantic": {
    "color": {
      "primary": { "base": { "$type": "color", "$value": "{option.color.blue.500}" } },
      "surface": {
        "base": {
          "$type": "color", "$value": "{option.color.white}",
          "$extensions": { "transtyle.modes": { "color-scheme": { "dark": "oklch(0.2 0.02 255)" } } }
        }
      }
    }
  }
}
```

This file, with the manifest above and the standard rule pack, is a *complete, compilable design system*: everything else (hover states, on-colors, secondary, scales, shadows…) derives — with every derived value marked and explainable. That's the minimal-input promise of the vision, delivered without magic.

## Validation & DX

- Published JSON Schemas for manifest and token files → editor autocomplete and red squiggles with zero custom tooling.
- `transtyle init` scaffolds the pair above interactively (brand color prompt → working system).
- All diagnostics reference file + line (source maps from LOAD) and carry stable codes (`TST1042`) for suppression and docs deep-links.
