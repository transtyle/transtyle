---
title: 'A compiler for design systems'
description: 'Theming is an N×M problem, and token pipelines only solve half of it. Here is what changes when you treat a design system as source code — and compile it.'
date: '2026-08-29'
author: 'Julien Déramond'
---

Your brand blue lives in six places.

It is a hex value in Figma. It is `$primary` in a Bootstrap Sass override. It is `--primary` in a shadcn `globals.css`, twice — once for light mode, once for dark. It is `color[0]` in an ECharts theme JSON. It is `colorPrimary` in a Storybook manager config. Somewhere there is a `.docx` brand book with the same hex printed under a paragraph nobody reads.

Change the blue, and you have six pull requests, five reviewers who each know one framework, and one of them will be missed. Six months later nobody can say which copy is authoritative — only which one is on production.

That is the tax. Every organization with more than one front-end framework pays it, forever, and it is nobody's job because it is everybody's.

## The shape of the problem

The tax is not a discipline failure. It is arithmetic. With **N** design systems and **M** target ecosystems, hand-maintained theming costs **N × M** mappings — and every framework upgrade invalidates a column.

<svg id="nxm" viewBox="0 0 760 250" role="img" aria-label="Left: three design systems each connected by a separate line to four frameworks — twelve mappings. Right: the same three systems connected to one shared pivot, which connects to the four frameworks — seven mappings." style="max-width:100%;height:auto;margin:1.5rem 0">
  <style>
    /* Selectors are id-scoped on purpose: this is raw HTML inside markdown, so
       a bare `.nl` here would be a global rule on whatever page includes it.
       Every var() carries its light-theme fallback: this diagram also travels
       in the RSS feed, where the site's stylesheet doesn't exist and an
       unresolved var() would drop to the SVG default of solid black. */
    #nxm .nl { stroke: var(--border, #dbdee3); stroke-width: 1.4; fill: none; }
    #nxm .nl.hi { stroke: var(--primary, #2d69de); stroke-width: 1.8; }
    #nxm .nb { fill: var(--surface, #ffffff); stroke: var(--border, #dbdee3); stroke-width: 1.2; }
    #nxm .nb.hub { fill: var(--primary-soft, #e0ecff); stroke: var(--primary, #2d69de); }
    #nxm .nt { fill: var(--text, #12161d); font: 600 11px 'JetBrains Mono Variable', monospace; }
    #nxm .nt.hub { fill: var(--primary-strong, #0e4ec8); }
    #nxm .nc { fill: var(--text-muted, #4f5661); font: 700 11px 'Inter Variable', system-ui, sans-serif; letter-spacing: 0.06em; }
    #nxm .nn { fill: var(--text-muted, #4f5661); font: 400 11px 'Inter Variable', system-ui, sans-serif; }
  </style>
  <text class="nc" x="0" y="14">BY HAND — N × M</text>
  <text class="nn" x="0" y="238">3 systems × 4 frameworks = 12 mappings to maintain</text>
  <g>
    <path class="nl" d="M96 52 H244 M96 52 L244 92 M96 52 L244 132 M96 52 L244 172"/>
    <path class="nl" d="M96 106 L244 52 M96 106 L244 92 M96 106 L244 132 M96 106 L244 172"/>
    <path class="nl" d="M96 160 L244 52 M96 160 L244 92 M96 160 L244 132 M96 160 L244 172"/>
    <g>
      <rect class="nb" x="6" y="38" width="90" height="28" rx="7"/><text class="nt" x="20" y="56">system A</text>
      <rect class="nb" x="6" y="92" width="90" height="28" rx="7"/><text class="nt" x="20" y="110">system B</text>
      <rect class="nb" x="6" y="146" width="90" height="28" rx="7"/><text class="nt" x="20" y="164">system C</text>
      <rect class="nb" x="244" y="38" width="98" height="28" rx="7"/><text class="nt" x="258" y="56">Bootstrap</text>
      <rect class="nb" x="244" y="78" width="98" height="28" rx="7"/><text class="nt" x="258" y="96">shadcn</text>
      <rect class="nb" x="244" y="118" width="98" height="28" rx="7"/><text class="nt" x="258" y="136">ECharts</text>
      <rect class="nb" x="244" y="158" width="98" height="28" rx="7"/><text class="nt" x="258" y="176">PrimeNG</text>
    </g>
  </g>
  <text class="nc" x="400" y="14">THROUGH A PIVOT — N + M</text>
  <text class="nn" x="400" y="238">3 bindings + 4 exporters = 7 mappings, each reusable</text>
  <g>
    <path class="nl hi" d="M484 52 L530 106 M484 106 H530 M484 160 L530 106"/>
    <path class="nl hi" d="M626 106 L666 52 M626 106 H666 M626 106 L666 136 M626 106 L666 176"/>
    <g>
      <rect class="nb" x="400" y="38" width="84" height="28" rx="7"/><text class="nt" x="412" y="56">system A</text>
      <rect class="nb" x="400" y="92" width="84" height="28" rx="7"/><text class="nt" x="412" y="110">system B</text>
      <rect class="nb" x="400" y="146" width="84" height="28" rx="7"/><text class="nt" x="412" y="164">system C</text>
      <rect class="nb hub" x="530" y="78" width="96" height="56" rx="10"/>
      <text class="nt hub" x="546" y="102">catalog</text><text class="nt hub" x="546" y="120">(meanings)</text>
      <rect class="nb" x="666" y="38" width="88" height="28" rx="7"/><text class="nt" x="678" y="56">Bootstrap</text>
      <rect class="nb" x="666" y="78" width="88" height="28" rx="7"/><text class="nt" x="678" y="96">shadcn</text>
      <rect class="nb" x="666" y="118" width="88" height="28" rx="7"/><text class="nt" x="678" y="136">ECharts</text>
      <rect class="nb" x="666" y="158" width="88" height="28" rx="7"/><text class="nt" x="678" y="176">PrimeNG</text>
    </g>
  </g>
</svg>

This is the oldest trick in compiler engineering. Machine translation between twenty languages does not hire translators for four hundred language pairs; it translates through a pivot. Babel does not have a converter per syntax pair; it parses to one AST. LLVM does not have a compiler per language-and-chip combination; it has frontends, an intermediate representation, and backends.

**Transtyle applies that architecture to design systems.** You describe your system once, in standard [W3C design tokens](https://design-tokens.github.io/community-group/format/). It compiles native theme files for each ecosystem you target.

<div class="schema" role="img" aria-label="You write design tokens; Transtyle normalizes, derives and validates them; you ship a native theme per framework plus a coverage report">
  <div class="s-col">
    <span class="s-kicker">You write</span>
    <span class="s-main">Your decisions, your names</span>
    <span class="s-sub">the tokens you already maintain, in a standard format any design tool can read</span>
  </div>
  <div class="s-arrow" aria-hidden="true">→</div>
  <div class="s-col hi">
    <span class="s-kicker">Transtyle compiles</span>
    <span class="s-main">translate · fill gaps · check</span>
    <span class="s-sub">binds your names to a shared vocabulary of meanings, completes what you never decided, verifies contrast</span>
  </div>
  <div class="s-arrow" aria-hidden="true">→</div>
  <div class="s-col">
    <span class="s-kicker">You ship</span>
    <span class="s-main">A native theme per framework</span>
    <span class="s-sub">files a Bootstrap or shadcn practitioner would recognize as their own — plus a report grading every value</span>
  </div>
</div>

Concretely, on the example system that ships with the repository:

```
$ npx transtyle check

shadcn         42% native · 53% derived · 3% approximated · 3% dropped
shadcn-v3      42% native · 53% derived · 3% approximated · 3% dropped
echarts        45% native · 18% derived · 18% approximated · 9% dropped · 9% unsupported
daisyui        17% native · 65% derived · 9% approximated · 9% dropped
bootstrap       8% native · 69% derived · 5% approximated · 10% dropped · 8% unsupported
storybook      63% native · 19% derived · 13% approximated · 6% dropped
css-variables  100% native
radix          41% native · 58% approximated · 1% dropped
primeng        69% native · 19% derived · 3% approximated · 9% unsupported

✔ check passed
```

Hold that output in mind — we will come back to why a compiler that tells you it only mapped 8% of something _natively_ is the honest one in the room.

## Is this actually new?

That question deserves a straight answer, because "new" is the cheapest word in software.

**What is not new:** design tokens as an idea (a decade old). The DTCG format (a W3C community group standard; Transtyle's input files are valid DTCG plus namespaced extensions, so Figma, Tokens Studio and Style Dictionary can read them unchanged — there is no proprietary format to migrate into). Token pipelines — [Style Dictionary](https://styledictionary.com/) has been transforming token files into platform outputs for years, and [Terrazzo](https://terrazzo.app/) does it DTCG-natively with a clean plugin model. Per-framework theme generators exist for nearly every target listed above. And the compiler metaphor itself is borrowed shamelessly from Babel and LLVM.

The existing pipelines solve the **bottom half** of the problem beautifully: given token files, produce variable files. What none of them do is the **top half** — understand what a design system _means_, and produce configuration that a specific framework actually consumes.

That gap has four parts, and each one is a falsifiable claim rather than a slogan.

### 1. A pivot vocabulary of meanings, not names

Style Dictionary will happily emit `--color-brand-blue-600` for every platform you ask. It has no opinion about which of your tokens is "the danger color", because it has no vocabulary for danger.

Transtyle's [catalog](/docs/language/) is that vocabulary: a fixed set of semantic slots — `primary.solid`, `danger.on-tint`, `elevation.3.surface`, `text.muted` — that exporters bind to. Your names map _into_ it once; each framework's names map _out of_ it, maintained by people who know that framework.

```
your semantics            the catalog (pivot)          each library's semantics
──────────────            ───────────────────          ────────────────────────
"brand-action"   ─alias→  primary.solid        ─table→  --primary        (shadcn)
"flame-soft"     ─alias→  primary.tint         ─table→  $primary-bg-subtle (Bootstrap)
(nothing)        ─rule──→ primary.on-solid     ─table→  --primary-foreground
```

The reason this has to exist — and the reason a simple rename table cannot replace it — is **false friends**. The same word means different things in different ecosystems:

| Word          | In the catalog                       | In shadcn                            | In Bootstrap                    | In Radix                           |
| ------------- | ------------------------------------ | ------------------------------------ | ------------------------------- | ---------------------------------- |
| **secondary** | your second _brand_ color            | a subtle gray button surface         | a theme color (close to ours)   | —                                  |
| **accent**    | brand emphasis color                 | a hover-highlight tint               | not a concept                   | the _only_ brand color (≈ primary) |
| **subtle**    | `<role>.tint` — one wash, all states | `muted`, a surface + foreground pair | `-bg-subtle` / `-border-subtle` | steps 3–5, a _range_ of values     |

Bind Bootstrap's `secondary` to shadcn's `secondary` because they are spelled the same and you have shipped a bug. Bind both by meaning through a pivot, and the collision becomes harmless. This is why the catalog was designed from a comparative study of **14 ecosystems** rather than reverse-engineered from whichever framework we happened to like — a vocabulary shaped like one library's internals is that library's config file wearing a neutral name.

The shape that study produced is the part experts should poke at hardest. Colors are not a flat list of roles; each role is a **grid** — prominence crossed with interaction state, plus paired foregrounds:

```
prominence →   solid            tint            outline          text
rest           solid            tint            outline          text
hover          solid-hover      tint-hover      outline-hover    text-hover
active         solid-active     tint-active     —                text-active
selected       solid-selected   tint-selected   —                —
on-colors      on-solid         on-tint         —                —
```

Radix's 12 steps, Ant Design's map tokens, Bootstrap's subtle triad, Chakra's `colorPalette` and Material 3's container/`on-*` pairs are all differently-named samples of that same grid. Once you see it, you cannot unsee it — and once you encode it, an exporter for a system you have never heard of is a mapping table, not a research project.

### 2. Derivation as a compiler stage

A real framework needs far more values than any human wants to author: hover shades, pressed shades, a readable foreground for every colored background, tinted washes, focus rings, the whole dark-mode mirror, an eight-color chart palette.

Transtyle computes them, from the decisions you did make, with **fixed, versioned, published rules**. Not AI, not "smart defaults" — arithmetic in a perceptual color space, the same input producing the same output byte for byte, forever.

Two properties keep that from being a black box. First, **authored always wins**: every derived value is a proposal, and authoring the token — down to one dark-mode hover shade — makes the rule step aside. Second, **every value can explain itself**:

```
$ npx transtyle explain semantic.color.primary.on-solid

semantic.color.primary.on-solid = oklch(1 0 0)  [#ffffff]
 └─ derived by rule contrast-pick@standard@1
    inputs: semantic.color.primary.solid = oklch(0.55 0.18 255)  [#026fd7]
     └─ aliased → option.color.blue.600
```

That is the whole audit trail for one value: which rule, from which of your tokens, in what order. A designer can read it without reading any code. An accessibility reviewer can check that the white-on-blue pairing was _chosen for contrast_, not picked by eye. Nobody has to trust us — the trail is in the build output.

### 3. Lossiness measured instead of hidden

Translation between real ecosystems is lossy, in ways that have nothing to do with effort. A `rem` radius has to become a pixel number in an ECharts theme JSON. Radix models each color as twelve steps plus a parallel alpha ramp — a shape no other system carries the information to reconstruct exactly. Some values simply have no destination.

Every tool in this space faces that. Most respond by quietly emitting something plausible. Transtyle grades itself instead — per variable, every build:

- <span class="prov native">native</span> — the target has a first-class slot; the mapping is lossless
- <span class="prov derived">derived</span> — synthesized by a named rule, then mapped natively
- <span class="prov approx">approx</span> — mapped, but the meaning bent to fit; the reason is recorded
- **dropped** — this target simply cannot say it; omitted with a note, never faked
- **unsupported** — the target has a themable slot we do not cover yet; an admission on the record

Here is the real GOV.UK Design System — a public system nobody on this project designed — compiled to all eight targets:

<div class="covmatrix" role="img" aria-label="Coverage bars per target for the GOV.UK example: css-variables 100% native; primeng 69% native; storybook 61% native; shadcn 50% native, 47% derived; echarts 50% native; radix 42% native, 58% approximated; daisyui 32% native, 55% derived; bootstrap 2% native, 76% derived">
  <div class="cm-row"><span class="cm-name">css-variables</span><span class="cm-bar"><span class="cm-seg native" style="width:100%"></span></span></div>
  <div class="cm-row"><span class="cm-name">primeng</span><span class="cm-bar"><span class="cm-seg native" style="width:69%"></span><span class="cm-seg derived" style="width:19%"></span><span class="cm-seg approx" style="width:3%"></span><span class="cm-seg other" style="width:9%"></span></span></div>
  <div class="cm-row"><span class="cm-name">storybook</span><span class="cm-bar"><span class="cm-seg native" style="width:61%"></span><span class="cm-seg derived" style="width:16%"></span><span class="cm-seg approx" style="width:13%"></span><span class="cm-seg other" style="width:10%"></span></span></div>
  <div class="cm-row"><span class="cm-name">shadcn</span><span class="cm-bar"><span class="cm-seg native" style="width:50%"></span><span class="cm-seg derived" style="width:47%"></span><span class="cm-seg approx" style="width:3%"></span></span></div>
  <div class="cm-row"><span class="cm-name">echarts</span><span class="cm-bar"><span class="cm-seg native" style="width:50%"></span><span class="cm-seg derived" style="width:20%"></span><span class="cm-seg approx" style="width:20%"></span><span class="cm-seg other" style="width:10%"></span></span></div>
  <div class="cm-row"><span class="cm-name">radix</span><span class="cm-bar"><span class="cm-seg native" style="width:42%"></span><span class="cm-seg approx" style="width:58%"></span></span></div>
  <div class="cm-row"><span class="cm-name">daisyui</span><span class="cm-bar"><span class="cm-seg native" style="width:32%"></span><span class="cm-seg derived" style="width:55%"></span><span class="cm-seg approx" style="width:9%"></span><span class="cm-seg other" style="width:5%"></span></span></div>
  <div class="cm-row"><span class="cm-name">bootstrap</span><span class="cm-bar"><span class="cm-seg native" style="width:2%"></span><span class="cm-seg derived" style="width:76%"></span><span class="cm-seg approx" style="width:5%"></span><span class="cm-seg other" style="width:18%"></span></span></div>
</div>

<p class="covmatrix-legend"><span><i class="native"></i>native — lossless</span><span><i class="derived"></i>derived — computed by a rule</span><span><i class="approx"></i>approximated — meaning bent, reason recorded</span><span><i class="other"></i>dropped / unsupported — this target can't say it</span></p>

Read the shape, not a single number — and never compare one target's bar to another's. Each measures a different surface with a different ceiling. `css-variables` is 100% native because it is the conformance dump: it has a slot for everything by construction. `radix` is 58% approximated because its 12-step alpha ramps are a fixed projection rather than a colorimetric reconstruction — a compromise stated out loud. And `bootstrap` is 2% native / 76% derived across **712 classified rows** because GOV.UK authored a handful of colors and the standard rules coherently filled a very large variable surface from them. A high derived share is not a weakness; it is the compiler doing the work you did not want to do by hand, and telling you it did.

And the compromises are not summarized away into a percentage. Each one carries its reason, verbatim, in `report.json`:

| Target  | Item                                    | Grade          | The note, as written by the exporter                                            |
| ------- | --------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| echarts | `tooltip.borderRadius`                  | `approximated` | rem → px (base 16)                                                              |
| radix   | `--primary-a4`                          | `approximated` | fixed alpha ramp, not a colorimetric derivation of Radix's real per-color alpha |
| echarts | series-specific styles (candlestick, …) | `unsupported`  | beyond catalog semantics; extend the emitted theme manually                     |

That last row is the interesting one. It is a tool writing down, in its own output, something it cannot do — and shipping it to you anyway.

A build is not "done" at 100% native — that is impossible across real ecosystems. It is done when the report matches your intent: your decisions authored, coherent derivation for the rest, every compromise known and accepted. **The report is the product.** Everything else is plumbing.

### 4. Native artifacts, all the way down to components

The last difference is the least glamorous and the most load-bearing: what lands on disk.

A generic pipeline emits variables and leaves you to wire them up. Transtyle emits `_variables.transtyle.scss` and `_maps.transtyle.scss` that import around Bootstrap's own Sass build the way Bootstrap's docs tell you to; a `globals.transtyle.css` with `@theme inline` that drops into a Tailwind v4 shadcn project; an ECharts theme JSON that registers directly. Delete Transtyle afterwards and the files still work — there is **no runtime**, nothing shipped into your application, no dependency to audit.

That extends past the color-role layer into component theming, which is where "themed" usually stops being true. Bootstrap exposes 952 themable Sass variables, 657 of them component-scoped; PrimeNG's Aura preset exposes 2,759 design-token slots across 98 families. Both inventories are checked into the repository and drift-guarded in CI, and every single slot is accounted for in the coverage report — driven by a token, inherited through the target's own chaining, left on its default, or honestly reported as a gap with a note.

The component tier is also where a distinction most token formats cannot express becomes one authored line:

```
author component.control.radius  →  buttons AND inputs move    ("controls are rounder")
author component.button.radius   →  only buttons move          ("buttons are pills")
```

Two targets that model this in incompatible ways still reproduce the distinction: Bootstrap chains buttons and inputs through a shared `$input-btn-*` root, PrimeNG keeps `button.*` and `formField.*` entirely separate. One line, a pill button in both, and form fields untouched in either.

The catalog does not grow to swallow all of that, and the rule for when it may is deliberately severe: **two independent exporters must need the identical thing for architectural, not nominal, reasons.** Control padding and radius passed — Bootstrap and PrimeNG both couple a button's box to a form field's box, arrived at separately. The small/large size ladder failed: both have one, and they disagree about which rungs it has. The disagreement _is_ the finding. Everything a single target needs stays inside that target's exporter, where it belongs.

### Where this could be wrong

Honest launch posts include the parts that could fail.

The catalog is a **bet** that these meanings are genuinely universal. It survived two real, independently-designed systems ([GOV.UK](/docs/govuk-showcase/) and IBM Carbon) compiling to eight targets with zero catalog amendments and zero diagnostics — but two is not many, and the systems that will break it are the ones we have not seen. Translation stays lossy no matter how good the reports get; if you need pixel-identical rendering across frameworks, no tool can give you that, and we say so rather than implying otherwise. The DTCG spec has not settled modes and theming upstream, so our extensions have to be deletable when it does. And the risk is not primarily engineering: it is whether an ecosystem that has been re-implementing themes by hand for a decade wants to stop.

## How it works, in five schemas

Everything above rests on five ideas. If you read only this section, you will still be able to argue with us competently.

### The pipeline

Every build runs the same six stages. Only one of them touches your disk.

<div class="flow" role="img" aria-label="The six pipeline stages in order: load, normalize, derive, resolve, emit, report">
  <span class="fnode">LOAD</span><span class="farr">→</span>
  <span class="fnode">NORMALIZE</span><span class="farr">→</span>
  <span class="fnode hi">DERIVE</span><span class="farr">→</span>
  <span class="fnode">RESOLVE</span><span class="farr">→</span>
  <span class="fnode">EMIT</span><span class="farr">→</span>
  <span class="fnode">REPORT</span>
</div>

| Stage     | What happens                                                                         |
| --------- | ------------------------------------------------------------------------------------ |
| LOAD      | Read the config and the token files it lists                                         |
| NORMALIZE | Merge layers, resolve aliases (cycles detected), expand modes, parse colors to OKLCH |
| DERIVE    | Fill every unauthored catalog slot with deterministic rules                          |
| RESOLVE   | Map the completed token graph onto each target's native theming surface              |
| EMIT      | Write native artifacts — the only stage that writes files; `check` skips it          |
| REPORT    | Classify coverage, raise diagnostics, emit `report.json`                             |

No network, no timestamps, no randomness: identical inputs produce byte-identical outputs, and CI proves it on every commit.

### The three tiers

<div class="tiers">
  <div class="tier">
    <span class="tier-name">option</span>
    <span class="tier-ex">color.blue.600 · font.mono</span>
    <span class="tier-desc">raw values — <strong>your</strong> private vocabulary, any names you like</span>
  </div>
  <div class="tier-link" aria-hidden="true">↓ alias</div>
  <div class="tier public">
    <span class="tier-name">semantic</span>
    <span class="tier-ex">primary.solid · text.base · elevation.0.surface</span>
    <span class="tier-desc">meaning — the stable public surface exporters bind to</span>
  </div>
  <div class="tier-link" aria-hidden="true">↓ alias</div>
  <div class="tier">
    <span class="tier-name">component</span>
    <span class="tier-ex">component.control.* · component.button.*</span>
    <span class="tier-desc">optional per-component refinement, defaulting from semantic</span>
  </div>
</div>

Exporters bind **only** to the semantic tier. Rename your entire raw palette tomorrow and no target output changes, as long as the semantic aliases still point somewhere sensible. If you run a design system, you already have these tiers; you probably call them primitives and aliases.

### Modes

A mode is a declared axis of variation — `color-scheme: light | dark` is the familiar one, and a second axis such as density composes with it. Every token resolves per mode, unspecified values fall back to the default, and one rule matters more than it sounds: **`default` declares your system's native mode.** A dark-native design system still compiles correctly into shadcn's light-first `:root` / `.dark` structure, because the exporter binds mode _names_, not the assumption that light comes first.

### Provenance and coverage

Two orthogonal labels, which people conflate constantly. **Provenance** answers _where did this value come from_ — <span class="prov authored">authored</span>, aliased, <span class="prov derived">derived</span>, or defaulted. **Coverage** answers _how well did it survive the trip into this target_ — the native/derived/approximated/dropped/unsupported classes above. A value can be authored by you and still approximated on arrival, because the target cannot express what you meant. Both labels sit on every row of every `report.json`.

### The binding layer

This is the part that decides whether adoption takes an afternoon or a quarter. You do **not** rename anything. You keep your token files, your names, your Figma sync, your governance — and add a thin layer of one-line aliases stating what your names mean.

GOV.UK was adopted exactly that way. Their `error` colour becomes the catalog's danger role with one alias, and everything downstream follows:

```
$ npx transtyle explain semantic.color.danger.text

semantic.color.danger.text = oklch(0.488 0.167 25.6)  [#aa2729]
 └─ derived by rule contrast-pick(text)@standard@1
    inputs: semantic.color.danger.solid = oklch(0.558 0.186 25.6)  [#ca3535]
     └─ aliased → semantic.color.govuk.error
    inputs: semantic.color.elevation.0.surface = oklch(1 0 0)  [#ffffff]
     └─ aliased → semantic.color.govuk.body-background
```

Note what that trace shows: an accessible red for _text_ was computed against the _actual page background_ of that system, not against an assumed white. That is the difference between a translation layer and a search-and-replace.

## Who this is actually for

### If you are one person with a side project

Three tokens is a working design system here — a brand color, a page background, a text color. (Not a figure of speech: a CI check compiles exactly that three-token system against all eight exporters on every commit, because a tool that only works on lavishly-authored systems is a tool for people who already have a design system.) You get a complete, dark-mode-ready, contrast-checked theme for whichever framework you picked — plus the other seven, free, on the day you change your mind about the framework.

The real win is subtler: you get a _coherent_ system without knowing color theory. Hover states that move the right amount. Foregrounds that pass WCAG AA because a rule checked, not because they looked fine on your monitor. A chart palette that is actually distinguishable. Things a design systems team would have given you, if you had one.

And the exit is free. The output is plain theme files; there is no runtime, no lock-in, and no import from us anywhere in your app. If you abandon Transtyle next year, you keep everything it wrote.

### If you are a product team with more than one framework

The moment you have a Storybook, an app, and a dashboard with charts, you have the N×M problem in miniature — three theming surfaces, three dialects, one brand. This is where "regenerate everything from one source" stops being an abstraction and starts being the Tuesday afternoon you get back.

The generated files are disposable by design: check them in, never edit them, regenerate on change. Because rebuilds are byte-identical, a token change shows up as exactly the lines it moved — and `transtyle diff` reports it semantically, per target, against any git ref. That turns "we changed the brand blue" into a reviewable pull request instead of an act of faith.

### If you run a design system at a large organization

This is the case the project was built for, and it is less about convenience than about **evidence**.

- **One source of truth that can prove it is the source of truth.** Provenance turns "trust us" into a queryable chain, per value, per mode, per target. That is an audit artifact, and regulated organizations spend real money faking it today.
- **Accessibility becomes a build step.** Contrast is checked during compilation against the real surface a value lands on, and failures are diagnostics with stable codes — `check` in CI, not a manual sweep before a release.
- **Framework migration stops being a project.** Moving a product from one library to another begins with a recompile and a coverage report telling you precisely what will not survive, _before_ anyone estimates the work.
- **Federated teams stay federated.** The catalog is a published interface. Your platform team owns the decision layer; product teams consume native artifacts in their own stack; nobody has to learn anybody else's dialect. Exporters are plugins on a public API, so a team with an internal component library can write and own one without touching the compiler.
- **Procurement-friendly by construction.** MIT-licensed, local-first, no hosted service, no telemetry, no account, no runtime dependency entering your application's supply chain.
- **Agent-operable.** JSON in, JSON out, stable diagnostic codes, deterministic builds. AI agents can drive the config; the compiler itself stays rule-based and auditable, which is exactly the boundary a serious organization wants between generated and guaranteed.

GOV.UK and IBM Carbon are in the repository as worked proof — not because we partnered with anyone, but because both publish their tokens, and a system you cannot compile without editing is a system you have not really adopted.

## What it deliberately is not

Scope discipline is the survival strategy of a project like this, so the boundaries are permanent, not "not yet":

1. **Not a component library.** We generate configuration for other people's components and ship no UI code.
2. **Not a design tool.** We do not edit tokens visually; we read the files your design tool already writes.
3. **Not a promise of pixel-perfect equivalence.** The contract is measured fidelity, not false equivalence.
4. **Not a fork of your framework.** If Bootstrap cannot express something, we report it; we do not ship a patched Bootstrap.
5. **Not an AI theming assistant.** Derivation is deterministic and inspectable. An agent can write the config; it will never be inside the compiler.

## Where it stands, honestly

This is a **v0** release. Here is the actual state, with no rounding up.

**Real today:** the full pipeline; the derivation engine (role grids, elevation ladder, scales, modes); `build`, `check`, `explain`, `init`, `add`, and `diff` — the last one comparing the compiled themes against a git ref, so a token change arrives in review as "here is what moved, in every target"; eight exporters — shadcn/ui, daisyUI, Apache ECharts, Bootstrap, Storybook, Radix Themes, PrimeNG, and plain CSS variables — all on the same public plugin API, with a conformance kit gating them in CI; four example systems, two of them real and independently designed, with 32 runnable demo projects rendering the compiled themes on each target's actual components; component-tier theming on Bootstrap and PrimeNG; JSON schemas for config and reports; zero runtime dependencies; byte-identical rebuilds verified on every commit.

**Specced but not implemented:** `preview`, and `import` with the importers behind it — the reverse direction that turns an existing Tailwind config, Figma variable set, or CSS custom-property sheet back into tokens. The first release deliberately targets design systems that already speak DTCG.

**Still moving:** the catalog can change in place until publication, and the plugin API reaches semver stability at 1.0. The [roadmap](/docs/roadmap/) tracks all of it, including the parts that are not done.

Start here:

```bash
git clone https://github.com/transtyle/transtyle && cd transtyle
npm install
cd examples/acme && npx transtyle build
```

Then read [How Transtyle works](/docs/how-transtyle-works/) if you want the code-free version, [Adopt an existing design system](/docs/adopt-existing/) if you already have tokens and names you intend to keep, or [the language reference](/docs/language/) if you want to argue with the catalog. That last one is the most useful thing you can do for this project: the vocabulary only earns the word "universal" by surviving systems it was not designed against.

Bring us the design system that breaks it.
