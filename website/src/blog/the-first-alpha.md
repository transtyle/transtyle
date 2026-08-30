---
title: 'Transtyle 0.1.0-alpha is on npm'
description: 'Twelve packages published, a documentation site deployed, and an explicit list of what will break. What the alpha is for, and what it is not.'
date: '2026-08-30'
author: 'Julien Déramond'
---

Transtyle is on npm. Twelve packages under [`@transtyle`](https://www.npmjs.com/org/transtyle), all
at `0.1.0-alpha.1`, and the documentation you are reading is deployed rather than previewed on
somebody's laptop.

This post is not a launch. It is the point at which the project becomes possible to _try_, which is
a different and much smaller claim.

## Try it

```bash
npm i -D @transtyle/cli
npx transtyle init
npx transtyle add bootstrap
npx transtyle build
```

`init` scaffolds a config and a starter token file, `add` wires up a target, `build` compiles. Every
build writes a `usage.md` next to its artifacts telling you how to wire them into that ecosystem,
and a `report.json` recording where each value came from and what the target could not express.

If you already have a design system, start at [I already have a design
system](/docs/adopt-existing/) instead — the whole point of the binding layer is that you do not
rename anything you already have.

## What is actually built

<!-- measured: exporters = 8 -->

Eight exporters: shadcn/ui, daisyUI, Bootstrap, Apache ECharts, Storybook, Radix Colors, PrimeNG,
and plain CSS custom properties. Two of them — Bootstrap and PrimeNG — reach the **component tier**,
which is the part that took the longest and is the reason the alpha happened now rather than three
months ago. Theming a colour palette is easy. Theming a real component library's button, across
every variant and severity and state, without lying about the slots you could not reach, is not.

<!-- measured: examples = 4 -->

Four worked examples carry it: two invented, and two real, independently-designed systems adopted
from the outside — [GOV.UK](/docs/govuk-showcase/) and IBM Carbon. Those two matter more than the
invented ones, because nobody designed them with this compiler in mind.

Everything is deterministic. Two builds of the same input are byte-identical, and there is a check
in CI that proves it by building twice and comparing bytes.

## What will break

Everything, potentially, and without a deprecation cycle. That is what the alpha label is for, and
it is [written down](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md)
rather than implied: the token vocabulary, the generated output, the config format and the CLI
surface can each change between alpha releases.

Two consequences worth acting on:

- **Pin an exact version.** `@transtyle/cli@0.1.0-alpha.1`, not a range.
- **Treat generated files as output.** Regenerate them; never hand-edit and keep them. The compiler
  will happily overwrite your careful manual fix, and that is the correct behaviour.

The freeze that stops all this arrives at the first release whose version carries no prerelease
identifier. Until then, breaking things in place is deliberate — it is much cheaper to correct the
vocabulary now than to carry a mistake through a major version.

## What this is not, yet

- **No importers except DTCG.** Tailwind config, Figma variables and CSS custom properties as
  _inputs_ are all designed and none are built. If your tokens are not DTCG, the front door is shut.
- **No stability promise, and no support promise.** Issues are welcome; a response time is not
  offered.
- **Not proven by anyone but me.** Four examples and eight exporters is evidence, not adoption. The
  most useful thing anyone could do with this alpha is try it on a design system I have never seen
  and tell me where it fails.

That last one is the actual reason for publishing. The compiler's central bet is that a small,
frozen pivot vocabulary can carry an arbitrary design system into an arbitrary ecosystem — and a bet
like that is only ever settled by someone else's tokens.

Start at [Getting started](/docs/getting-started/), or read [what is built vs.
planned](/docs/roadmap/) first if you would rather know the shape of the gaps before you spend an
afternoon.
