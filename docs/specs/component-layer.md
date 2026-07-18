# Component abstraction layer (v2 — design sketch, not a v1 deliverable)

Deferred by [ADR-0003](../adr/0003-tokens-first.md). This document exists so v1 decisions don't foreclose v2 — and to record *which* component problem we will solve, because the obvious framing is the one that kills projects.

## The trap we will not walk into

"Describe a Modal once, generate every framework's Modal" is effectively cross-framework component code generation. Framework components differ irreconcilably in behavior, composition model, accessibility internals, and API philosophy (compare Radix's compound-component Combobox to Bootstrap's data-attribute dropdown). Projects that attempted universal component abstraction (Diez; countless "write once, render anywhere" UI DSLs) collapsed under the matrix. **We will never generate component implementations.**

## What we will do instead: component *theming* abstraction

The tractable, high-value 90%: describe how components should **look** — not how they work — and bind that to each framework's existing theming surface. This is exactly the reserved `component` token tier ([ir.md](../architecture/ir.md#the-three-tier-token-model)) coming alive:

```jsonc
"component": {
  "button": {
    "radius":   { "$value": "{semantic.radius.interactive}" },
    "paddingX": { "$value": "{semantic.space.4}" },
    "variants": { "$extensions": { "dsx.variants": {
      "primary": { "bg": "{semantic.color.primary.base}", "fg": "{semantic.color.text-on-primary.base}" },
      "ghost":   { "bg": "transparent", "fg": "{semantic.color.primary.base}" }
    } } }
  }
}
```

Targets bind this to what they already expose: Bootstrap's `$btn-*` Sass variables and `--bs-btn-*` CSS vars, shadcn's per-component classes/vars, MUI's `components.MuiButton.styleOverrides`, Chakra/Mantine component themes. Every mainstream framework has a component *theming* surface even though none share a component *implementation* model — that asymmetry is the whole insight.

## Planned scope of the v2 catalog

A fixed component catalog (mirroring the semantic catalog discipline): Button, Input, Select, Checkbox/Radio/Switch, Badge, Card, Modal/Dialog, Tooltip, Popover, Tabs, Accordion, Alert/Toast, Table, Dropdown/Menu, Combobox. For each: dimensional tokens (radius, padding, borders, shadows, typography), state tokens (hover/active/disabled/focus), and a variant model (named variant → role bindings). Defined per component in the IR spec with the same additive-only stability rules.

Derivation extends naturally: component tokens default from semantic tokens (`button.radius ← radius.interactive ← radius.md`), so an empty `component` tier compiles today and forever — the tier is pure, optional refinement.

**Behavioral mapping** ("Bootstrap dropdown → Radix DropdownMenu") remains out of scope for v2 as *generation*, but the component catalog gives us the vocabulary to ship a cheaper artifact later: equivalence *maps* (docs/data, not code) that migration tooling could consume.

## Preconditions before v2 work starts (from ROADMAP)

The token IR has survived ≥1 year of real use without a major revision; ≥3 community exporters exist (proof the plugin contract is learnable); and at least two reference exporters have hand-written component-theming prototypes (Bootstrap `$btn-*`, shadcn button vars) that we can generalize *from evidence* rather than design a priori. The v2 spec process starts as an RFC against real exporter data.

## What v1 must preserve (checklist enforced now)

- `component` top-level group: parsed, validated, carried in IR, ignored by exporters — already specced.
- Coverage classes already accommodate component bindings (nothing to add).
- The plugin manifest `capabilities` array leaves room for `"components"`.
- Nothing in the semantic catalog encodes component names (e.g. no `color.button-bg` slot — that belongs to the component tier).
