# Backlog — the register of possibilities

Everything that has been proposed, considered or noticed and **not yet committed to**. One line per
possibility, with what it is worth, what it costs, and whether it is ready to start.

This file exists because good ideas were evaporating. Working sessions kept ending with "here are
four things you could do next", the maintainer picked one, and the other three were gone —
regenerated differently, or not at all, the next time. Options are cheap to produce and expensive to
re-derive; they belong in a file, not in a scrollback.

## How this is maintained

- **Everything proposed lands here.** Any option offered at the end of a working session is written
  into the register in the same session, before the turn ends — including the ones not chosen, and
  especially those. An option that only ever existed in a chat message did not exist.
- **This is not the plan.** [ROADMAP.md](../ROADMAP.md) holds what the project has _committed_ to —
  phases, exit criteria, and the R/P/I/D/AL/C/T ledgers. An item graduates from here to there when
  the maintainer decides to do it; graduating means a ROADMAP slot, an ADR if it changes a design
  decision, an execution spec in `docs/plan/` if it is large enough to hand to somebody, and the
  [CONTRIBUTING sync rule](../CONTRIBUTING.md) applied. Live ROADMAP items are listed under
  [Committed elsewhere](#committed-elsewhere) so this file is still a complete picture of what could
  be worked on next.
- **Nothing is deleted, only resolved.** Items end as `done` (with what shipped) or `dropped` (with
  why). A rejected idea is a finding — the reason it was rejected is the part worth keeping, and
  this project has already twice re-derived a decision it had made and forgotten.
- **IDs are `BL-nn` and never reused.** The older `B1…B10` numbers mean two different things in two
  different documents already ([the July audit](audit-2026-07.md) numbers engine findings; this
  file's original B1–B5 numbered product ideas), which is exactly the confusion a fresh prefix
  avoids. Those older items are reconciled in [Archive](#archive).

## Scales

**Value** — what it is worth against the project's actual bet: that a small pivot vocabulary can
carry an arbitrary design system into an arbitrary ecosystem, and that other people will try it.
Evidence that tests the bet outranks polish that decorates it.

**Effort** — `S` under half a day · `M` a day or two · `L` several days · `XL` weeks, or open-ended.

**Status** — `ready` (specified enough to start now) · `idea` (needs a decision or a design pass
first) · `blocked` (by the named thing) · `queued` (a task is already spun off) · `watch` (deliberately
waiting for a named trigger) · `done` · `dropped`.

**Model** — which Claude model suits the work, per the house convention in
[docs/plan/component-tier.md](plan/component-tier.md): **Opus** for open-ended judgment with
long-lived consequences, **Sonnet** for well-specified work following an established pattern. On
**Fable**: no verified capability documentation exists in this project's context — check Anthropic's
current model docs before assigning it anything rather than guessing.

## The register

| ID              | Item                                                      | Area      | Value | Effort | Status               | Model         |
| --------------- | --------------------------------------------------------- | --------- | ----- | ------ | -------------------- | ------------- |
| [BL-01](#bl-01) | A fifth example: a design system of a shape not yet tried | Evidence  | High  | L      | idea                 | Opus          |
| [BL-02](#bl-02) | Seed GitHub Discussions with the feedback ask             | Reach     | High  | S      | ready                | Opus          |
| [BL-03](#bl-03) | Announce the post outside the repo                        | Reach     | High  | S      | ready                | Opus + human  |
| [BL-04](#bl-04) | Fix the site header overflowing on mobile                 | Site      | High  | S      | queued               | Sonnet        |
| [BL-05](#bl-05) | Register `transtyle.dev`                                  | Infra     | High  | S      | blocked (maintainer) | human         |
| [BL-06](#bl-06) | `create-transtyle` initializer                            | Adoption  | High  | M      | ready                | Sonnet        |
| [BL-07](#bl-07) | A ninth exporter, from the B3 order                       | Ecosystem | High  | L      | idea                 | Opus → Sonnet |
| [BL-08](#bl-08) | Side-by-side compare view for two demos                   | Site      | Med   | M      | idea                 | Opus → Sonnet |
| [BL-09](#bl-09) | Hostile-adoption round two                                | Evidence  | Med   | M      | ready                | Opus          |
| [BL-10](#bl-10) | Compiled figures on the exporter docs pages               | Docs      | Med   | M      | ready                | Sonnet        |
| [BL-11](#bl-11) | A social card for the blog post                           | Reach     | Med   | S      | ready                | Sonnet        |
| [BL-12](#bl-12) | Demo switcher keeps your place                            | Site      | Med   | S      | ready                | Sonnet        |
| [BL-13](#bl-13) | `derivation.overrides` — specced, unimplemented           | Compiler  | Med   | M      | idea                 | Opus          |
| [BL-14](#bl-14) | Option-scale generator (one colour → a ramp)              | Compiler  | Med   | M      | idea                 | Opus          |
| [BL-15](#bl-15) | APCA as an alternate contrast standard                    | Compiler  | Med   | M      | idea                 | Opus          |
| [BL-16](#bl-16) | Per-demo Open Graph cards                                 | Reach     | Low   | S      | idea                 | Sonnet        |
| [BL-17](#bl-17) | Real screenshots as gallery thumbnails                    | Site      | Low   | M      | idea                 | Opus          |
| [BL-18](#bl-18) | Palette perceptual-distance warning                       | Compiler  | Low   | S      | ready                | Sonnet        |
| [BL-19](#bl-19) | The four deferred catalog promotions                      | Catalog   | —     | —      | watch                | Opus          |
| [BL-20](#bl-20) | Reconcile the three ID namespaces                         | Repo      | Low   | S      | done                 | —             |

### If you want to pick something now

- **Highest value for the least work:** BL-02 and BL-03. The post asks people to bring their design
  systems and there is currently nowhere for them to land, and nobody outside this repository knows
  the post exists.
- **Highest value overall:** BL-01. It is the thing the post promises and the only thing that
  actually settles the project's central bet.
- **Needs you, not me:** BL-05 (money and a decision) and the R1 sign-off under
  [Committed elsewhere](#committed-elsewhere) — a practitioner review pass nobody else can do.

---

## Items

### BL-01

**A fifth example: a design system of a shape not yet tried** · Evidence · High · L · idea · Opus

**What.** Adopt another real, published design system through the binding layer, as GOV.UK and
Carbon were, and add it as a fifth `examples/` entry with its eight demos.

**Why.** Four examples, two of them invented, is the honest limit of the current evidence — the post
says so in as many words. Every clean compile is a small confirmation; the first one that is _not_
clean is worth more than all of them, because it exposes something the catalog cannot say.

**The open question is which one**, and it should be chosen for the shape it attacks rather than for
fame:

- **multi-brand** — one system, several brands as a declared mode axis. Nothing in the examples
  exercises a non-colour-scheme axis except Acme's toy `density`.
- **a container/`on-*` system** — Material 3 is named in the post as one of the grid's samples but
  has never been compiled. It would test the role grid against the vocabulary most unlike it.
- **a system with a real type and spacing story** — every current example is colour-dominated;
  Spectrum or USWDS would push on the scales the engine derives but nothing much consumes.
- **RTL or non-Latin typography** — an axis the catalog has never been asked about at all.

**Done when** it compiles to all eight targets, its demos render, and the findings doc says what the
catalog could not express — including "nothing", if that is the answer.

### BL-02

**Seed GitHub Discussions with the feedback ask** · Reach · High · S · ready · Opus

**What.** Open the categories and a first thread — "Bring me the design system that breaks it" —
with a short template for what to report: the system, what compiled, what the coverage report said,
what the catalog could not express.

**Why.** The blog post's closing ask now points at Discussions, and Discussions is empty. A first
thread that models the shape of a useful report is the difference between feedback and a shrug.

**Done when** the thread exists, is pinned, and the post's link lands somewhere that reads as
inhabited.

### BL-03

**Announce the post outside the repo** · Reach · High · S · ready · Opus to draft, maintainer to post

**What.** Draft the announcements — Bluesky, Mastodon, LinkedIn, and whichever Bootstrap-adjacent or
design-systems channels are appropriate — each written for its own audience rather than the same
paragraph five times.

**Why.** The post is the artifact everything else now links to, and its reach is currently zero.
BL-02 should land first so arrivals have somewhere to go.

**Note.** Publishing is the maintainer's; drafting is not. Depends on BL-11 for a card worth
attaching.

### BL-04

**Fix the site header overflowing on mobile** · Site · High · S · queued · Sonnet

**What.** `.site-nav` measures 479px inside a 375px viewport, so **every page of the site scrolls
sideways on a phone**. Verified on the homepage, a docs page and the blog post. Adding "Demos" to
the nav is the likely trigger.

**Why.** It is the most visible defect on the site, it affects every visitor on a phone, and it is
small.

**Status.** A task is already spun off. Done when `scrollWidth === clientWidth` at 320/375/768px on
the homepage, a docs page and the post, with the theme toggle still reachable and focusable.

### BL-05

**Register `transtyle.dev`** · Infra · High · S · blocked on the maintainer · human

**What.** Buy the domain and point the site at it.

**Why.** The published JSON schemas identify themselves as `https://transtyle.dev/schemas/...`.
Those URLs are already in the alpha's packages and in four example configs, and they do not resolve.
They were deliberately not repointed at the Pages URL — a `$id` is an identifier, and moving it
twice is worse than leaving it unresolvable once. The site move itself is a two-line config change
(`website/astro.config.mjs`).

**Blocked on** a purchase and a decision, neither of which is mine. This is the tail of ROADMAP's
R5, which is deliberately still open for exactly this reason.

### BL-06

**`create-transtyle` initializer** · Adoption · High · M · ready · Sonnet

**What.** The remaining half of the original theme-kit idea ([Archive, B2](#archive)): an npm
initializer that scaffolds a project with tokens, a config, and a demo app per chosen target.

**Why.** It was gated on npm publication for a year. **That gate is gone** — the packages shipped
2026-08-30 — and nobody has revisited it since. `npx transtyle init` already covers the
tokens-and-config half; what is missing is the "and here is it running" half that the 32 demo
projects have proven is the convincing part.

**Done when** `npm create transtyle` produces a project that builds and runs without editing.

### BL-07

**A ninth exporter, from the B3 order** · Ecosystem · High · L · idea · Opus for the mapping study, Sonnet to implement

**What.** The next target from the priority list: **Mantine** (CSS vars + a TS theme object),
then Chakra (semantic-token native, close to a 1:1 with the catalog), MUI (enormous adoption,
deepest surface), Ant Design (validates non-Western-ecosystem reach).

**Why.** Every new target is a test of the claim that an exporter for an unfamiliar system is a
mapping table rather than a research project — and each one widens who has a reason to care. Chakra
is the cheapest and MUI is the most persuasive.

**Done when** it passes the conformance kit, has a demo for all four examples, and lands on all five
surfaces per the sync rule.

### BL-08

**Side-by-side compare view for two demos** · Site · Med · M · idea · Opus for the design, Sonnet to build

**What.** A page holding two demos in split iframes with a synced light/dark toggle and a shared
target/system picker.

**Why.** The parity argument — same markup, different tokens — currently requires the visitor to
click the switcher and remember what they just saw. Side by side, it needs no explanation at all.

**Design question first:** whether it belongs in the gallery as a mode, or as its own route. Depends
on nothing; BL-12 makes it better.

### BL-09

**Hostile-adoption round two** · Evidence · Med · M · ready · Opus

**What.** Repeat the P4 experiment — take a real project that has never heard of Transtyle and theme
it — on a second, differently-shaped codebase.

**Why.** P4 (Miniflux) paid for itself immediately: it produced the `rgb()`/`hsl()`/named-colour
support the engine was missing, and it is why the CSS-custom-property importer is on the list at
all. One data point, though, and the finding is a year old.

**Done when** there is a findings doc saying what stopped it, in the same shape as
[hostile-adoption.md](findings/hostile-adoption.md).

### BL-10

**Compiled figures on the exporter docs pages** · Docs · Med · M · ready · Sonnet

**What.** Extend `scripts/gen-figures.mjs` so each exporter page carries a figure painted in that
target's own emitted values, the way the blog post's four now are.

**Why.** The exporter pages describe their output entirely in prose and coverage bars. The machinery
to show it instead already exists and is already guarded against drift.

**Done when** each of the eight pages has one, and `check:figures` covers them.

### BL-11

**A social card for the blog post** · Reach · Med · S · ready · Sonnet

**What.** `scripts/gen-social-card.mjs` renders a card from a live compile of `examples/acme`, but
its output is gitignored and referenced by nothing, so the post currently shares as the generic
auto-generated OG image.

**Why.** The post is the front door now, and the card is what people see before they decide whether
to open it. The renderer already exists; what is missing is a decision about committing its output
and pointing the post's frontmatter at it.

**Depends on** nothing. Should land before BL-03.

### BL-12

**Demo switcher keeps your place** · Site · Med · S · ready · Sonnet

**What.** The corner switcher jumps to the top of the destination demo. Preserve scroll position, or
better, the section, across a switch.

**Why.** Comparing two systems means comparing the _same part_ of two pages, and today that means
scrolling back down every time.

### BL-13

**`derivation.overrides`** · Compiler · Med · M · idea · Opus

**What.** Declarative rule overrides in the config — specced in the derivation document, never
implemented. Today the only way to override a derived value is to author the token.

**Why.** Authoring works but does not scale to "make every hover shade 4% darker than the standard
pack does". It is the difference between overriding a value and overriding a _rule_.

**Design question first:** whether a config-level rule override can stay auditable — `explain` has
to keep telling the truth about where a value came from, and a user-supplied rule is a new kind of
provenance.

### BL-14

**Option-scale generator** · Compiler · Med · M · idea · Opus

**What.** Derive a full 50–950 ramp from one authored brand colour. In the derivation spec, not
implemented.

**Why.** It is the missing half of the "three tokens is a working design system" claim: today a
minimal system gets a complete _semantic_ layer derived, but its option tier stays as thin as it was
authored. Radix and daisyUI both want real ramps.

### BL-15

**APCA as an alternate contrast standard** · Compiler · Med · M · idea · Opus

**What.** `check.contrast.standard` currently accepts WCAG 2.1 AA. Add APCA as a selectable
alternative.

**Why.** WCAG 2.1's contrast maths is known to misjudge light-on-dark, which is precisely the case a
dark-native system like Cathode lives in. Being able to say which standard a build was checked
against is the kind of claim this project is otherwise careful about.

### BL-16

**Per-demo Open Graph cards** · Reach · Low · S · idea · Sonnet

**What.** Cards for `/demo/<example>/<target>/`, painted from the same compiled palettes the gallery
uses.

**Why.** Every demo link currently shares as the generic site card, so 32 different pages look
identical when posted. Low value until somebody is actually sharing them — worth doing _with_ BL-03,
not before.

### BL-17

**Real screenshots as gallery thumbnails** · Site · Low · M · idea · Opus

**What.** Capture each demo in a headless browser and use the images as gallery cards.

**Why, and why it is Low.** This was near the top of the list before `gen-figures.mjs` existed. The
compiled figures now cover most of its value while a screenshot pipeline would add a browser
dependency and — because browser text rendering is not byte-stable across platforms — an asset class
that cannot be drift-checked the way everything else in this repository is. The remaining honest
gap is **typography**: the figures render in Inter because GDS Transport and IBM Plex are not ours
to redistribute, so the one thing a screenshot would genuinely add is the real typefaces.

**Decide before building:** whether that gap is worth an unguarded asset class. It may simply be
"no", in which case this becomes a `dropped` entry with the reasoning, which is a fine outcome.

### BL-18

**Palette perceptual-distance warning** · Compiler · Low · S · ready · Sonnet

**What.** Warn when two colours in a derived categorical chart palette are too close to distinguish.
Flagged "pending" in the ECharts exporter spec.

**Why.** The chart palette is derived from one brand colour on most systems, so nobody authored it
and nobody eyeballed it. A palette that looks fine in the demo can collapse on a real dataset.

### BL-19

**The four deferred catalog promotions** · Catalog · watch · Opus

Not work — a **watch list**. [Proposal 0003](proposals/0003-component-catalog-generalization.md)
deliberately refused four candidates for the shared `component.*` catalog, each with a written
reason, and each reopens only on a named trigger: a second independent exporter needing the
identical thing for **architectural, not nominal**, reasons.

- **the sm/lg size ladder** — both Bootstrap and PrimeNG have one and they disagree about the rungs;
  the disagreement is the finding.
- **nav / list item padding** — nominal correspondence only.
- **table cell padding, component sizing, icon assets** — single-source; no second consumer.
- **overlay veil / mask timing** — a real near-miss, and the one most likely to reopen first.

**Trigger.** BL-07's next component-heavy exporter is the event that could reopen any of these.
Check this list when it lands, rather than rediscovering the arguments.

### BL-20

**Reconcile the three ID namespaces** · Repo · done

`B1–B5` in this file's original form were product ideas; `B1–B10` in
[audit-2026-07.md](audit-2026-07.md) are engine findings; ROADMAP's `B7` is one of the audit's,
promoted. Three meanings, one prefix. Resolved by this rewrite: new items are `BL-nn`, the audit
keeps its own letters as a point-in-time document, and the old product ideas are reconciled below.

---

## Committed elsewhere

These are in [ROADMAP.md](../ROADMAP.md) and are not repeated as register items — but they are real
answers to "what next", so they are listed here to keep this file a complete picture.

| ROADMAP | Item                                          | State                                                                                      |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R1      | T11 practitioner sign-off, and Phase 1's exit | Open, **needs the maintainer** — engineering is done, the review pass is not               |
| R2      | Freeze-readiness audit ratification           | Ratifies when R1 signs                                                                     |
| R5      | Website on a real domain                      | Pages half done; the domain tail is [BL-05](#bl-05)                                        |
| P3      | Recruited third-party exporter pilot          | Open; tests the v1.0 exit criterion. Unblocked by the alpha, never restarted               |
| P5      | Browser playground                            | Open                                                                                       |
| I1      | Tailwind config importer                      | Open, ahead of I2 per P4's finding: the codebase, not the design file, is where tokens are |
| I2      | Figma variables importer                      | Open                                                                                       |
| I3      | Watch mode + CI recipe                        | Open                                                                                       |
| I4      | CSS custom-property importer                  | Candidate; the one that would have automated the Miniflux adoption                         |

## Archive

The original product ideas from the 2026-07-18 maintainer review, and what became of them.

| Was | Item                                    | Outcome                                                                                                                        |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Editorial policy: implemented-only docs | **Adopted.** User-facing docs may name an unimplemented capability only inside an explicit status construct; in CONTRIBUTING   |
| B2  | Starter template ("theme kit")          | **Half shipped** — the demo-app half became the 32 demo projects. The initializer half is now [BL-06](#bl-06)                  |
| B3  | Target priority list                    | **Folded into ROADMAP.** daisyUI, Bootstrap, Storybook, Radix, PrimeNG all shipped; the remaining order is now [BL-07](#bl-07) |
| B4  | "Adopt an existing design system" guide | **Done** — [adopt-existing.md](../website/src/docs/adopt-existing.md)                                                          |
| B5  | "The Transtyle language" reference      | **Done** — [language.md](../website/src/docs/language.md)                                                                      |

The July audit's own A/B/C/D findings live in [audit-2026-07.md](audit-2026-07.md) and keep their
numbering there; the ones still open have been lifted into the register above
([BL-13](#bl-13), [BL-14](#bl-14), [BL-15](#bl-15), [BL-18](#bl-18)).
