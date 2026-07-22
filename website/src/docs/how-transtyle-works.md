---
title: "How Transtyle works"
description: "The compiler mental model in one diagram — still no code."
order: 21
---

# How Transtyle works

[Design tokens](/docs/what-is-a-design-token/) gave you one decision layer; the problem left over was translating it into every framework's dialect, by hand, forever. Transtyle's answer is to treat your design system like source code: **you write it once, and a compiler builds it for each platform.**

<div class="schema" role="img" aria-label="You write design tokens; Transtyle normalizes, derives and validates them; you ship native themes for every framework">
  <div class="s-col">
    <span class="s-kicker">You write</span>
    <span class="s-main">Your decisions, your names</span>
    <span class="s-sub">the tokens you already maintain — a standard format any design tool can read</span>
  </div>
  <div class="s-arrow" aria-hidden="true">→</div>
  <div class="s-col hi">
    <span class="s-kicker">Transtyle compiles</span>
    <span class="s-main">translate · fill gaps · check</span>
    <span class="s-sub">binds your names to a shared vocabulary of meanings, completes what you didn't decide, verifies contrast</span>
  </div>
  <div class="s-arrow" aria-hidden="true">→</div>
  <div class="s-col">
    <span class="s-kicker">You ship</span>
    <span class="s-main">A native theme per framework</span>
    <span class="s-sub">files a Bootstrap or shadcn practitioner would recognize as their own — plus an honesty report</span>
  </div>
</div>

Four ideas make that middle box trustworthy.

## 1. A pivot language, like translators use

Translating between twenty languages doesn't need translators for every pair — it needs one shared *interlingua* everyone translates through. Transtyle's version is [the catalog](/docs/language/): a fixed vocabulary of **meanings** — "the action color", "the raised surface", "destructive, at rest, as a filled button".

Your names map *into* the catalog once — you declare "our `flame` is the action color" — and each framework's names map *out* of it, maintained by the people who know that framework. You never learn Bootstrap's dialect; you state your meanings once.

This is also the defense against **false friends**: your "secondary" and Bootstrap's "secondary" share a spelling, not a meaning. Binding happens by meaning, never by name similarity — so the collision becomes harmless.

## 2. Derivation fills what you didn't decide

Frameworks need far more values than you'd ever want to hand-author: hover shades, pressed shades, readable text on every colored background, subtle tinted washes, a chart palette, the whole dark-mode mirror. Transtyle computes every one of these from the decisions you *did* make, using **fixed, versioned rules** — the hover shade is a defined nudge of your color, the foreground paired with your blue is chosen to pass contrast, the chart palette is rotated from your brand hue.

Two properties keep this safe:

- **Deterministic.** Same input, same output, byte for byte, forever. No AI, no randomness, no surprises in Friday's build.
- **You always win.** Every derived value is a proposal, not a verdict. Decide any of them yourself — down to a single dark-mode hover shade — and the rule steps aside.

## 3. Every value can explain itself

Ask the compiler about any value in the output and it answers with the value's ancestry: which rule produced it, from which of your decisions, in which order. Nothing is magic; everything has a paper trail. Designers can audit the system without reading any code — the walkthrough on the next page shows this live.

## 4. It's honest about what doesn't fit

Translation between real frameworks is never lossless, and pretending otherwise is how trust dies. So every build grades its own output, value by value:

- <span class="prov native">native</span> — your decision, expressed losslessly in the framework's own terms
- <span class="prov derived">derived</span> — computed from your decisions by a named rule
- <span class="prov approx">approximated</span> — expressed, but the meaning bent to fit; the reason is recorded
- **dropped** — this framework simply can't say it; omitted, with a note, instead of faked

The goal is not 100% native — that's impossible across real ecosystems. The goal is a report that matches your intent: your decisions authored, coherent derivation for the rest, every compromise known.

## What it deliberately doesn't do

Transtyle ships **no code into your product** — output is plain theme files; delete the tool and the files still work. It **doesn't rename your system** — the catalog is compilation plumbing your designers never see. And it **doesn't promise pixel-perfect equivalence** across frameworks — it promises measured, explained fidelity instead.

**Next:** [Your first build](/docs/your-first-build/) — ten minutes, real commands, real output.
