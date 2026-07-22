# Findings: hostile adoption — a real product with no design tokens (P4)

**Tests [W2](../plan/strategic-review-2026-07.md)**: *"GOV.UK/Carbon generalize to real-world adoption."* Those two are published, token-mature, semantically disciplined design systems — the easiest real inputs that exist, and both were adopted by this project itself. This experiment deliberately picks the opposite: a real shipping **product** with a hand-rolled design language, no token files, no semantic tier, and no one who intended it to be portable.

**Subject:** [Miniflux](https://github.com/miniflux/v2) (Apache-2.0), a minimalist RSS reader. Source: `internal/ui/static/css/{common,light,dark}.css`, fetched 2026-07-22. Values transcribed verbatim; nothing invented.

**Working extraction:** kept in a scratch dir, **deliberately not promoted to `examples/`** — see [Promotion decision](#promotion-decision).

## Why this input is genuinely hostile

Miniflux declares **89 CSS custom properties**, and not one is semantic:

- **Every name is component + part + property** — `--button-primary-background`, `--table-th-background`, `--entry-content-quote-color`, `--feed-has-unread-background-color`. There is no tier that says "this is our danger color"; there are only places where a color is used.
- **No palette layer.** Values are literals at the point of declaration. `#333` appears under **13 different names** (`--body-color`, `--title-color`, `--panel-color`, `--table-th-color`, `--pagination-link-color`, …); `#ddd` under 7. Nothing records that these are *the same decision*.
- **The namespace mixes types.** Alongside colors sit `--item-padding: 5px`, `--item-title-link-font-weight: 600`, `--feed-parsing-error-border-style: solid`, `--input-border: 1px solid #ccc` (a composite), and `--input-focus-box-shadow`.
- **Literals bypass the variables anyway** — `common.css` hardcodes `#888`, `#339966`, `#d14836`, `brown`, `red`, `rgba(0,0,0,0.7)` directly in component rules.

This is the median product, and it is nothing like GOV.UK.

## Cost ledger

Effort is given as relative weight and step count rather than wall-clock, since this run was performed by an AI agent with web access; the *shape* of the cost is what transfers, not the duration.

| Step (playbook order) | What it took | Mechanical or judgment? |
|---|---|---|
| 0. Locate the source of truth | 3 fetches (`common.css` → found vars undeclared → directory listing → `light.css`, `dark.css`) | mechanical, but **not scripted** — a human must know where a product hides its colors |
| 1. "Dump your palette into `option.*` verbatim" | **Playbook broke — there is no palette.** Deduplicated 89 declarations into a 29-entry invented palette | **judgment** (naming) over mechanical (dedupe) |
| 2. Express your semantics under your names | Transcribed 25 catalog-relevant variables as `semantic.color.miniflux.*` | mechanical |
| 3. Bind the catalog | 15 slot bindings, **5 of them contested** (below) | **judgment** — the irreducible core |
| 4. Build + read the report | one command, 8 targets, zero errors after the workaround | mechanical |
| 5. Tighten | not attempted (see verdict) | — |

**Resulting coverage:** 318 resolved slots, of which **39 (12%) trace to Miniflux's real values** (`aliased`), 144 derived, 135 catalog defaults. Twelve percent authored is not a failure — it is the honest ratio for a system that only ever made ~25 color decisions.

### The five contested bindings (no tool can settle these)

| Catalog slot | The conflict |
|---|---|
| `primary.solid` | **Two competing blues**: links `#3366cc` vs primary buttons `#4d90fe` (plus a third for button borders, `#3079ed`). Bound to the button; the link is equally defensible. |
| `border` | **Three borders with different values**: item `#ddd`/`#666`, table `#ddd`/`#555`, hr `#ccc`/`#555`. The catalog has one slot; the source has three de facto. |
| `text.muted` | `entry-content-color` (`#555`/`#999`) vs `counter-color` (`#666`/`#bbb`) — neither is named "muted". |
| `ring` | Miniflux's focus indicator is literally `red`. Bound faithfully. |
| `link.visited` | `purple` (light) but `#f083e4` (dark) — an unexplained hue jump upstream. |

## Where the playbook broke

**1. Named CSS colors are a hard stop (audit [B7](../audit-2026-07.md)).** `red` and `purple` — used verbatim by Miniflux — are rejected: `TST1106 Unsupported color syntax (skeleton supports oklch() and #hex)`, cascading into `TST1105` dangling aliases. The build cannot proceed. The workaround is hand-converting to spec hex, which **violates the playbook's own step 1** ("verbatim, no renaming") and silently discards the author's intent.

> **This reclassifies B7.** It is filed as 🟢 "opportunity — accept `rgb()`/`hsl()`/named colors." On this evidence it is a **release blocker for real-world adoption**: cheap to fix, and it stops the median user at the first command. `rgb()`/`hsl()` will bite identically — most real CSS uses them.

**2. Step 1 assumes a palette that does not exist.** "Dump your raw values into `option.*` verbatim" presupposes a primitive tier. Products that never built one force the adopter to *invent* the palette — deduplicating literals and naming them — before the playbook's real work begins. The playbook needs an explicit branch for "you have no palette; here is how to synthesize one (and why the names don't matter)."

**3. Nothing automates extraction.** Finding, reading, and transcribing the CSS was the single largest cost, and it is exactly the part a machine should do.

## The headline result: the compiler exposed a latent defect in the product

Miniflux's dark theme **collapses its own status semantics**. Upstream, in `dark.css`:

```
--alert-error-color, --alert-success-color, --alert-info-color, --alert-color  →  #efefef
--alert-error-background-color, --alert-success-background-color, --panel-background  →  #333
```

Compiled faithfully, that yields:

```
danger.solid  = success.solid  = info.solid  = warning.solid  = #efefef   (dark mode)
```

Verified in the emitted artifacts — `dist/css-variables/variables.transtyle.css`'s dark block emits `oklch(0.952 0 0)` for all four, while the light block keeps them distinct.

**In the source this defect is invisible**: each variable is read by exactly one component, so the four never appear side by side, and no CSS review would catch it. Pivoting through a semantic catalog put them in one column and made it obvious. This is the strongest argument for the whole approach found so far — stronger than any mapping-fidelity claim — and it was produced by a system nobody designed to be portable.

(Transcribed faithfully rather than "fixed" on purpose. Leaving the dark values unbound would let them fall back to the light hues and quietly paper over a real upstream bug.)

## Verdict on W2

**The wedge works — the catalog was never the problem; the on-ramp is.**

- **The catalog held, again.** Zero amendments were needed to absorb a maximally hostile system — a third independent confirmation after Radix (T9) and GOV.UK/Carbon (T11). W3's "expressiveness is not the bottleneck" is now very well evidenced.
- **The binding-layer pattern held in shape**, and the judgment calls stayed small and explicit (5 contested bindings out of 15) — which is the design working as intended.
- **But the first mile is rough.** One trivial gap (B7) is a hard stop, and the playbook's opening step assumes structure the median product lacks.

So: *not* "importers must come first" in the sense of blocking everything — but **the cheap fixes at the entry point (B7, a no-palette playbook branch) buy more real-world adoptability than any further mapping work.**

## Consequence for Phase C order

The plan says this finding decides I1 (Tailwind importer) vs I2 (Figma importer). The honest answer is that **neither would have helped here** — Miniflux has no Tailwind config and no Figma library, and neither does any product in its class. The importer that would have collapsed steps 0–2 of this ledger is a **CSS custom-property / stylesheet importer**, which is not currently a scheduled task.

Recommendation, on one data point and stated as such:

1. **B7 first** (accept `rgb()`/`hsl()`/named colors) — hours of work, removes a hard stop.
2. **Keep I1 (Tailwind) ahead of I2 (Figma)** — unchanged. Tailwind configs are codebase artifacts, and this experiment says the codebase is where the median product's truth lives; I1 is also the cheaper build (audit D1).
3. **Add a CSS-variable importer as a candidate** and let it compete with I1 on the next planning pass. One sample is not enough to promote it above Tailwind's much larger installed base, but it is the importer this experiment actually asked for.

## Promotion decision

**Not promoted to `examples/`.** Doing so would trigger the five-surface sync obligations (a docs page, a README entry, `check-sync` coverage, and **eight new demo projects**) for a fifth example that teaches the same binding-layer pattern the existing four already teach. The transferable output of this experiment is this document, not another fixture. The extraction is fully specified above and reproducible from the cited sources in minutes if it is ever wanted.
