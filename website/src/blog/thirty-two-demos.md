---
title: 'Thirty-two demos, one page'
description: 'Every example design system, compiled to every target and deployed. The markup is identical across all of them — which is the entire argument.'
date: '2026-08-30'
author: 'Julien Déramond'
---

There is a claim this project has been making in prose since its first commit: compile a design
system once, and every ecosystem you ship in gets a theme that looks like it was written by hand for
that ecosystem.

Prose is a bad medium for that claim. It is a claim about what things _look like_.

So all 32 demo projects in the repository are now deployed: **[the demo gallery](/demo/)**. Four
design systems, eight targets each, running in a browser, every one of them rebuilt from the example
token files on each deploy.

## The interesting part is what does not change

Each demo is the same fake admin page — _Nimbus Console_ — built with a target's real components.
Acme's Bootstrap demo and Carbon's Bootstrap demo are not two pages that happen to resemble each
other. They are the same source files, byte for byte, and
[a CI check](https://github.com/transtyle/transtyle/blob/main/scripts/check-demo-parity.mjs) fails
the build if one of them drifts. That check exists because the drift already happened once: a
tooltip was added to Acme's demo and to nobody else's, and three files went out of sync before
anyone noticed.

Which means the comparison is clean. Open [Acme on Bootstrap](/demo/acme/bootstrap/), then use the
switcher in the corner to jump to [Cathode](/demo/cathode/bootstrap/). Every single thing that
changed — the colours, the corner radii, the type, the hover states, the focus ring, the dark mode —
came out of the compiler, from a different set of token files. Nothing else could have changed it,
because nothing else is different.

Then go the other way: from Cathode's Bootstrap page to
[Cathode's PrimeNG page](/demo/cathode/primeng/). Same design system, different ecosystem, different
framework, different component library, different language even — Angular rather than a Vite bundle.
It still looks like Cathode.

## Four systems, chosen to disagree

**Acme** is the ordinary case: one brand blue, a few neutrals, one radius. Most of what you see in
its demos was derived rather than authored.

**Cathode** is a retro CRT terminal built specifically to break assumptions. Its vocabulary has no
"primary" in it — the tokens are called `crt.ink`, `crt.tube`, `crt.glass`. It is dark-native, so
light mode is the paper-printout mode. Its brand colour is also its text colour. Its radius is zero,
which makes shadcn's `calc(var(--radius) - 4px)` negative, which browsers clamp to zero — brutalism
by accident of CSS.

**GOV.UK** and **Carbon** are real published design systems that nobody on this project designed.
They were adopted through the [binding layer](/docs/adopt-existing/): their own colour names stay
their own colour names, and a small file maps catalog slots onto them. GOV.UK ships no dark theme,
so its config declares one mode and the gallery says so rather than inventing one. Carbon carries
its real per-theme values, White for light and G100 for dark.

## The gallery is compiled too

The swatches on the gallery page are not hand-picked hexes that resemble the output. Every colour,
corner radius and typeface on that page is read out of a live compile of the four examples during
the site build. Change `option.color.blue.600` in `examples/acme` and the gallery card moves along
with the demos it links to, or the build fails saying which slot went missing.

That is the same rule the docs already follow for numbers: nothing on the site claims something
about the compiler that was not asked of the compiler while the page was being built.

## What it cost, and what it caught

The whole publishing step is under a minute of CI: 32 static builds, 33 MB, no build matrix and
nothing cached. Each demo is built with the same command a contributor runs, plus one argument that
makes its asset paths relative so it works from a subdirectory rather than a server root.

Publishing them surfaced four defects that local development had been hiding, which is the usual
reward for deploying something:

- The Angular demos referenced `/favicon.svg` from the server root — invisible locally, a 404 under
  any subdirectory. There is now a check that fails assembly on any root-absolute reference in a
  built demo.
- The Storybook demos pointed their brand image at a `/logo.png` that has never existed anywhere.
- GOV.UK's and Carbon's Storybooks were both listening on Acme's port, so two of them could not run
  at once — while their READMEs, the docs and the editor config all named three different ports.
- Three of the four demo READMEs said "seven projects" and had no PrimeNG row, months after PrimeNG
  shipped.

The last two were found by a new checker rather than by reading, which is the point of writing
checkers: the demo table now has to match the directory it describes, and the ports have to match
the `package.json` that opens them.

Start anywhere: **[the gallery](/demo/)**.
