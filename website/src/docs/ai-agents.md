---
title: 'Using Transtyle with AI agents'
description: 'Transtyle is built to be operated by machines: deterministic builds, stable codes, JSON reports, markdown-native docs.'
order: 9
---

# Using Transtyle with AI agents

Transtyle is designed to be operated by AI agents as a first-class use case — not because the compiler contains AI (it deliberately contains none; see below), but because a deterministic compiler with machine-readable contracts is exactly the kind of tool agents are good at driving.

## Why the design already fits agents

| Property                            | Why it matters to an agent                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deterministic builds**            | Same inputs → byte-identical outputs. An agent can reason about cause and effect; a diff means _its_ change did it.                                                                                                                                                                                                                                                                            |
| **Config is data**                  | The entire project state is JSON (manifest + DTCG token files). No code execution needed to read, write, or validate a project.                                                                                                                                                                                                                                                                |
| **Stable diagnostic codes**         | `TST1104` means the same thing forever. Agents can pattern-match remediation instead of parsing prose.                                                                                                                                                                                                                                                                                         |
| **Stable exit codes**               | 0 / 1 / 2 with documented meaning; stderr for logs. Scriptable without heuristics.                                                                                                                                                                                                                                                                                                             |
| **`report.json`**                   | Schema-versioned coverage + provenance for every emitted variable — the build explains itself in JSON. An `unsupported` row can name what it is missing (`meaning`), a key shared across exporters; `reads` lists the catalog slots the target read; a row carries its slot's `description`, and `deprecated` + `deprecatedBy` when its value still comes from a deprecated token (`TST1122`). |
| **`transtyle catalog --json`**      | Every slot exporters bind to, with its type, the rule that fills it and that rule's inputs — the vocabulary as data, no project needed.                                                                                                                                                                                                                                                        |
| **`check` = build minus emit**      | Agents can validate hypothetical states cheaply and safely before writing anything.                                                                                                                                                                                                                                                                                                            |
| **Authored-always-wins derivation** | An agent can make minimal edits with bounded blast radius: authoring one token changes that token and its derivatives, nothing else.                                                                                                                                                                                                                                                           |

## The agent workflow

The same loop a careful human uses, and it's fully machine-executable:

```bash
# 0. Learn the vocabulary: every slot, its type, how it derives
npx transtyle catalog --json
# 1. Author or edit tokens (plain JSON, schema known)
# 2. Validate without side effects
npx transtyle check          # exit code + coded diagnostics on stderr
# 3. Build
npx transtyle build shadcn
# 4. Read the machine report
cat dist/shadcn/report.json  # coverage classes + provenance per variable
# 5. Iterate: author overrides for anything classified `derived` that
#    the human (or a screenshot evaluation) rejects
```

Concrete recipes:

- **"Make me a theme from this brand color"** — write an 11-token project like the [Acme example](/docs/examples/), run `build`, return `globals.transtyle.css`. Derivation does the heavy lifting; the agent's job is only the brand facts.
- **"Fix the contrast warnings"** — run `check`, filter stderr for `TST2101` (each includes the measured contrast — a WCAG ratio, or an APCA `Lc` when `check --json`'s `contrast.standard` is `apca` — the token pair, and the mode), adjust the named token's lightness in OKLCH, re-run until clean.
- **"What breaks if I change this token?"** — run `check --matrix --json` and read `matrix.slots["<slot>"]`: the targets that read the slot, each with its coverage class and the variables it maps to. A target missing from that object never reads the slot, so editing it there is a no-op. After a build, the same per target is `reads` in its `report.json`. The [slot matrix](/docs/slot-matrix/) page is the same answer for the official exporters.
- **"Why does this target variable have this value?"** — run `explain --variable '<name>' --target <t> --json`: the variable's coverage rows, the variables it is chained to, the slots it reaches (`slots`) and one provenance tree per slot (`trees`), down to what was authored. `explain <slot> --target <t> --json` answers the other way round, in `target.consumers`.
- **"What should I author next?"** — run `check --completeness complete --json` and read `completeness.todo`: the slots worth a decision, in the order they pay off, each with its `state` (`missing`, `derived`, `defaulted`, `carried-over`) and a `reason`. Author the first few, re-run, stop when the list holds only what the human is happy to leave to derivation.
- **"Port this design system's weird vocabulary"** — follow the [Cathode pattern](/docs/examples/#cathode--the-hostile-example): express the vocabulary as custom semantic tokens, then write one-line catalog bindings. The agent never needs to understand the whole system — only to map meanings. Then run `check --json` and read `adoption.unbound`: the custom tokens no catalog slot reads yet, each with hints (the slots already set to the same value, or the slot whose name it shadows). Done when that list holds only the tokens meant for css-variables alone, and `TST1124` (a `secondary` or `accent` bound with shadcn's meaning) is absent. Start from `bind --suggest --json`: every unbound slot with its ranked candidates, each with a confidence and its reasons; review the `contested` and `low` ones first, they are the judgment calls.

## Machine-readable documentation

This site is agent-consumable by construction:

- **`/llms.txt`** — the [llms.txt convention](https://llmstxt.org): a compact index of this documentation with one-line summaries.
- **`/llms-full.txt`** — the entire documentation concatenated as plain markdown, for context windows that can afford it.
- **Every docs page as raw markdown** — append `.md` to any docs URL (e.g. `/docs/configuration.md`) to get the source markdown instead of HTML. Each HTML page links its markdown twin.
- **Stable heading anchors** — slugs are generated deterministically from heading text; deep links don't rot between builds.

## The boundary: AI outside, determinism inside

Transtyle will never embed AI in the compilation pipeline ([the vision's non-goal #5](/docs/internals/)). Derivation is deterministic rules, because a brand pipeline that produces different output on different days is worthless — to companies _and_ to agents, which need reproducibility more than humans do.

The intended division of labor: **agents write config; the compiler compiles it.** An agent with taste (or with a human in the loop) decides that `info` should be amber on a CRT theme; Transtyle guarantees that decision propagates to every target, identically, forever. The deterministic core is what makes agent-driven theming _auditable_: every value in production traces to either an authored token (someone's decision) or a versioned rule (everyone's convention).
