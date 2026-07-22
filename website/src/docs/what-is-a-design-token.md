---
title: 'What is a design token?'
description: 'The concept from zero, for designers and design-system leads — no code.'
order: 20
---

# What is a design token?

A design token is a **named design decision**. Not a color — a _decision about_ a color: what it's called, what value it holds, and what it means.

"Our action color is a specific blue" is a decision. Written as a token, it has three parts:

- a **name** — `primary`
- a **value** — <span class="sw" style="--c:oklch(0.55 0.18 255)"></span> a particular blue
- a **meaning** — "the color of the main thing we want people to do"

That third part is what makes tokens different from a palette. A palette is a list of paints; tokens say which wall each paint goes on.

## Two kinds of names

Mature design systems name things twice, on purpose:

**Value names** describe _what something is_: `blue-600`, `gray-50`, `red-500`. They're your paint buckets — stable, reusable, meaning-free. If you repaint the brand, `blue-600` becomes a different blue, and its name still makes sense.

**Meaning names** describe _what something is for_: `primary`, `danger`, `surface`, `text-muted`. They point at value names: `primary` → `blue-600`. This is where the design decisions live — and it's the layer everything downstream should read.

The payoff is leverage. When the brand shifts, you change **one pointer** — `primary` now points at a different bucket — and every button, link, and chart that meant "primary" follows. No search-and-replace, no drift, no forgotten corner of the product still wearing the old blue.

<div class="swatches">
  <div class="swatch"><i style="--c:oklch(0.55 0.18 255)" aria-hidden="true"></i><b>primary</b><span>the action color</span></div>
  <div class="swatch"><i style="--c:oklch(0.55 0.19 25)" aria-hidden="true"></i><b>danger</b><span>destructive, irreversible</span></div>
  <div class="swatch"><i style="--c:oklch(0.985 0.003 255)" aria-hidden="true"></i><b>surface</b><span>cards sit on this</span></div>
  <div class="swatch"><i style="--c:oklch(0.5 0.01 255)" aria-hidden="true"></i><b>text-muted</b><span>secondary text</span></div>
</div>

Meaning names also unlock **modes**: in dark mode, `surface` means a different value, but every component that says "surface" is still _correct_. The decision survives; only the value swaps.

## The problem tokens don't solve

Here's the catch. Your product teams don't build with your token names — they build with **frameworks**, and every framework has its own dialect for the same meanings:

| Your meaning           | shadcn/ui says | Bootstrap says     | daisyUI says |
| ---------------------- | -------------- | ------------------ | ------------ |
| the action color       | _primary_      | _primary_          | _primary_    |
| destructive            | _destructive_  | _danger_           | _error_      |
| raised surface (cards) | _card_         | _body-tertiary-bg_ | _base-200_   |

Same meanings, different words — and sometimes the **same word for different meanings**, which is worse: your "secondary" and Bootstrap's "secondary" are unrelated decisions that happen to share a spelling.

So the decision layer you carefully built gets re-translated **by hand, per framework, forever**: once into a Bootstrap theme, once into a shadcn stylesheet, once into a chart library's config. Each copy drifts. Each framework upgrade breaks one. Nobody is sure which copy is current.

That translation problem — keeping _one_ set of decisions and letting every framework speak it natively — is exactly what Transtyle exists for.

**Next:** [How Transtyle works](/docs/how-transtyle-works/) — the mental model, still no code.
