# Derivation engine

"Intelligent automatic mapping" is the vision's most seductive idea and its biggest credibility risk. A tool that silently invents brand colors will be rejected by exactly the professional audience we target. The engine is therefore built on three non-negotiables:

1. **Deterministic.** Same inputs → same outputs, forever, on every machine. No ML, no heuristic that depends on environment. ([ADR-0005](../adr/0005-deterministic-derivation.md))
2. **Explainable.** Every derived value answers `transtyle explain <token>` with the rule chain and inputs that produced it.
3. **Governable.** Every rule can be pinned, overridden, or disabled. Authored values always win. `check` can be configured to fail if *specified* tokens were derived rather than authored (`derivation.require: [color.danger, ...]`) — teams choose how much automation they trust.

## How it works

Derivation rules form a DAG evaluated to fixpoint during the DERIVE stage. A rule = `(target slot, inputs, function, priority)`. Rules only fill **holes** — slots in the [semantic catalog](ir.md#the-semantic-contract) with no authored value. They never overwrite.

Rule sources, by precedence: user-defined rules in config → rule-pack overrides → the built-in **standard rule pack** (versioned; pinned in config as `derivation.rules: "standard@1"` so upgrading the CLI cannot silently change your compiled theme — changing rule-pack versions shows up in `transtyle diff`).

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
| `text-on-<role>.base` | pick white/black/near-neutral maximizing contrast against `<role>.base`; **hard rule: if no candidate reaches WCAG AA 4.5:1, emit a warning naming the role — never silently ship failing contrast** |
| `text-on-<role>.subtle` | **on-brand walk** (ratified by [exercise F19](../exercises/phase0-shadcn-rerun.md), intent from [F1](../exercises/phase0-shadcn.md)): start at `<role>.active` (the state-consistent on-brand candidate), step OKLCH lightness away from `<role>.subtle` in 0.01 increments until the pair clears AA 4.5:1; if the lightness clamp is reached first, fall back to the max-contrast pick among `text`, white, near-black; same AA hard rule |
| `surface-raised` / `overlay` | raise(`surface`): toward white in light mode, lightness increase in dark mode; `overlay` defaults to alias of `surface-raised` |
| `ring` | alias of `primary.base`, lightened in dark mode for visibility ([exercise F3](../exercises/phase0-shadcn.md)) |
| `<role>.contrast` | the role re-anchored at text lightness: `{ l: text.base.l, c: role.c, h: role.h }` per mode — the role's hue/chroma pushed to text-level contrast against the mode's surfaces; gamut clamping applies. Fills a slot the catalog guaranteed but standard@1 never derived — caught when the engine had nothing where the Bootstrap exercise had consumed `neutral.contrast` twice, with two different hand values ([exercise F20](../exercises/phase0-bootstrap-rerun.md)) |
| `radius.{none,sm,lg,xl,full}` from `radius.md` | multiplicative ramp: none = 0, sm = md × 0.5, lg = md × 1.5, xl = md × 2, full = 9999px — multiplicative so the ramp stays sane at any authored `md`; exporters may re-express in the target's idiom ([exercise F8](../exercises/phase0-bootstrap.md)) |
| option color scales (`50…950`) from a single brand color | perceptual lightness ramp in OKLCH with chroma compensation |
| dark mode values (only if `derivation.autoDark: true`, default **off**) | lightness inversion + chroma adjustment per role; off by default because auto-dark is the least trustworthy derivation class — it must be opted into, and its output is classified `derived` in coverage so teams see exactly how much of their dark theme is synthetic |
| type scale from `base` + `ratio` | modular scale, rounded to a rounding policy |
| spacing scale from `base` unit | linear ×n scale |
| `scrim` | near-black at fixed alpha (dimming veil; distinct from `overlay` — [exercise F2](../exercises/phase0-shadcn.md)) |
| `shadow.*` | composed from `scrim` color at fixed alpha ramps |
| `z.*` catalog | fixed default ladder (defaulted, not derived) |

**Mix semantics (pinned by [exercise F21](../exercises/phase0-bootstrap-rerun.md)):** every `mix` in the rule pack and the expression language interpolates in **cartesian OKLab** (l, a, b components; alpha linear). Hue is therefore *not* preserved when the mix partner is chromatic: as chroma collapses toward a tinted surface, the result's hue drifts toward the surface hue (visible in dark-mode `subtle` tints over a blue-cast surface). This is deliberate — cartesian mixing is what makes heavy tints sit ambiently on their surface instead of glowing — but it was previously implied rather than specified, and a hue-preserving implementation would have been a conforming reading of "mixed toward surface". It is not one anymore.

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
