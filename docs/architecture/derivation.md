# Derivation engine

"Intelligent automatic mapping" is the vision's most seductive idea and its biggest credibility risk. A tool that silently invents brand colors will be rejected by exactly the professional audience we target. The engine is therefore built on three non-negotiables:

1. **Deterministic.** Same inputs → same outputs, forever, on every machine. No ML, no heuristic that depends on environment. ([ADR-0005](../adr/0005-deterministic-derivation.md))
2. **Explainable.** Every derived value answers `dsx explain <token>` with the rule chain and inputs that produced it.
3. **Governable.** Every rule can be pinned, overridden, or disabled. Authored values always win. `check` can be configured to fail if *specified* tokens were derived rather than authored (`derivation.require: [color.danger, ...]`) — teams choose how much automation they trust.

## How it works

Derivation rules form a DAG evaluated to fixpoint during the DERIVE stage. A rule = `(target slot, inputs, function, priority)`. Rules only fill **holes** — slots in the [semantic catalog](ir.md#the-semantic-contract) with no authored value. They never overwrite.

Rule sources, by precedence: user-defined rules in config → rule-pack overrides → the built-in **standard rule pack** (versioned; pinned in config as `derivation.rules: "standard@1"` so upgrading the CLI cannot silently change your compiled theme — changing rule-pack versions shows up in `dsx diff`).

## The standard rule pack (v0 catalog, foundations)

Illustrative, not exhaustive; the full table ships as a generated reference doc.

| Hole | Rule |
|---|---|
| `accent` | alias of `primary` |
| `secondary` | desaturated rotation of `primary` (OKLCH: chroma ×0.35, lightness toward neutral) — *not* "closest available token"; nearest-neighbor guessing is unexplainable and unstable under edits |
| `info` | fixed blue anchored to `primary`'s chroma |
| `success` / `warning` / `danger` | fixed hue anchors (green/amber/red) with chroma/lightness matched to the brand palette — hue is conventional, temperature follows the brand |
| role `hover` / `active` states | OKLCH lightness deltas from `base` (direction flips in dark mode) |
| role `subtle` | base mixed toward `surface` (the generic form of Bootstrap's `-bg-subtle` and shadcn's muted pairings) |
| `text-on-<role>` | pick white/black/near-neutral maximizing contrast against `<role>.base`; **hard rule: if no candidate reaches WCAG AA 4.5:1, emit a warning naming the role — never silently ship failing contrast** |
| option color scales (`50…950`) from a single brand color | perceptual lightness ramp in OKLCH with chroma compensation |
| dark mode values (only if `derivation.autoDark: true`, default **off**) | lightness inversion + chroma adjustment per role; off by default because auto-dark is the least trustworthy derivation class — it must be opted into, and its output is classified `derived` in coverage so teams see exactly how much of their dark theme is synthetic |
| type scale from `base` + `ratio` | modular scale, rounded to a rounding policy |
| spacing scale from `base` unit | linear ×n scale |
| `shadow.*` | composed from `overlay` color at fixed alpha ramps |
| `z.*` catalog | fixed default ladder (defaulted, not derived) |

## Provenance classes and the "defaulted" distinction

`derived` = computed *from the user's tokens* (secondary from primary). `defaulted` = catalog constant with no user input (z-index ladder). The distinction matters: derived values track the brand and change when the brand changes; defaulted values are ours, and coverage reports them separately so a team can see "your theme is 62% authored, 31% derived, 7% defaulted".

## User-defined rules

Config may add rules in a small declarative expression form (color functions: `mix`, `lighten`, `alpha`, `contrast-pick`; scale generators; aliases):

```jsonc
"derivation": {
  "rules": "standard@1",
  "overrides": {
    "semantic.color.secondary": { "alias": "option.color.slate.600" },
    "semantic.color.accent":    { "fn": "mix", "args": ["{semantic.color.primary}", "#ffffff", 0.15] }
  }
}
```

Arbitrary JS in rules is deliberately excluded from v1: it would break the "config is data" property ([specs/configuration.md](../specs/configuration.md)) and make `explain` output unreadable. If the expression language proves insufficient, extending it is an IR-spec discussion, not an escape hatch.

## Failure honesty

When a rule cannot produce a defensible value (e.g. `text-on-primary` against a mid-tone brand color where nothing reaches AA), the engine still produces the best candidate but attaches a `warning` diagnostic with the measured contrast and remediation hint. Derivation never blocks a build; it makes problems visible and lets `check` policy decide severity.
