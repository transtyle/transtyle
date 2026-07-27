# TST1204: surfacing the silent dark-mode brand-color fallback

The previous audit ([2026-07-27-warning-severity-audit.md](2026-07-27-warning-severity-audit.md))
flagged one gap outside its own scope: "brand color identical in dark mode" is
documented as intended behavior, but nothing in the compiler backs that claim
with a diagnostic — a user only learns it's expected if they happen to read the
docs page.

## The bigger thing found first

Before writing the diagnostic, its hint text needed to say something true. The
obvious hint — "author the value, or opt into `autoDark: true`" — is exactly
what `checks.js`'s existing `TST2101` hint already said. Checking whether that
remedy actually works: `derivation.autoDark` is read in exactly one place in
the whole compiler, inside that same hint string, to decide what to _say_, never
to change output. `normalize.js`'s per-dimension resolution substitutes the
default-mode value unconditionally, with no `autoDark` branch at all.
`derivation.md`'s "lightness inversion + chroma adjustment per role" row
describes a feature that doesn't exist yet — `roadmap.md`'s "Specced, not yet
implemented" table already listed "`autoDark` audit flow," but the architecture
doc and several user-facing pages asserted it as working, present-tense.

Fixed the misleading trail before adding anything new:

- `packages/core/src/checks.js`: removed "opt into autoDark" from the `TST2101`
  hint — it named a remedy that does nothing.
- `docs/architecture/derivation.md`: the standard-rule-pack table's autoDark row
  now says **specced, not implemented** and states plainly that the flag is read
  nowhere in the pipeline.
- `website/src/docs/derivation.md`, `diagnostics.md`, `configuration.md`: same
  correction in each, each now linking to the roadmap's "specced, not yet
  implemented" section instead of implying a working opt-in.

Filed the actual feature (real dark synthesis — lightness inversion + chroma
adjustment) as a separate, larger task rather than building it as a side effect
of one diagnostic.

## The diagnostic

`TST1204` (`info`), raised in `normalize.js`'s per-dimension resolution loop:
when a role's `.solid` anchor (built-in `COLOR_ROLES` or a custom role
archetype) is authored in the default mode but has no override for a
non-default `color-scheme` value, and the base token _is_ authored somewhere
(so this never doubles up with `TST1201`/`TST1203`, which cover total
absence) — the whole derived grid for that role in that mode carries the
default-mode color over unchanged. Scoped to `.solid` specifically because
that's the one cell an entire ~16-slot grid (hover/active/tint/outline/
on-colors) fans out from; scoped to `color-scheme` specifically because this
is about light/dark polarity, not every mode dimension.

Deduped per `(tokenPath, value)`, not per combo: a `color-scheme × density`
design system produces `dark+comfortable` and `dark+compact` combos that both
carry the same fact, and firing twice would double-count one authoring gap as
two.

Verified: fires exactly once on a two-dimension config (probed directly, not
inferred); does not fire when the base token is missing entirely (that stays
`TST1201`'s territory); does not fire for non-`.solid` role tokens (`surface`,
`text.base`) since they don't drive a derived grid the same way.

`check:all` green at 63.

## Following up: the filed task turned up a research trail, not a gap

Asked to implement the filed "real autoDark synthesis" task. Before writing a
lightness-inversion formula, searched for any existing spec grounding it and
found the actual reason nothing computes a dark color today: it isn't an
oversight. `docs/exercises/phase0-shadcn.md` F7 — revisited in
`phase0-bootstrap.md` and `phase0-storybook.md` across three exercise rounds —
is a still-open, deliberately deferred design question: "should a future
`standard@2` add an opt-in `darkBrandAdjust` rule class?" The evidence so far
argues against inventing one unilaterally: Bootstrap's own dark mode keeps
`$primary` constant (matches Transtyle's current default exactly), Storybook
chrome "looks normal" with a constant dark brand — only shadcn's stock themes
lighten brand colors in dark mode. Two of three reference targets currently
say the existing behavior is _correct_, not missing.

Inventing a transform now would have meant closing, alone, a question the
project's own cross-target validation process has explicitly kept open —
exactly the discipline `derivation.md` states elsewhere ("not 'closest
available token'; nearest-neighbor guessing is unexplainable and unstable").
Stopped and asked rather than guess; picked the minimal option: fix what
`autoDark` was _documented_ to do that's genuinely implementable without
inventing color science — correct provenance classification — and leave
`darkBrandAdjust` exactly as deferred as the exercise log left it.

### What `autoDark: true` now does

Nothing about the _compiled color_ changes — a role's `.solid` still carries
the default-mode value over when unauthored for a non-default `color-scheme`
value, same as before, same as with `autoDark` off. What changes is
provenance: `normalize.js` now tags that carry-over `PROVENANCE.DERIVED`
(with a `rule: 'auto-dark-carry(constant)@standard@1'` trace) instead of
`PROVENANCE.AUTHORED`, only when `config.derivation.autoDark` is `true`.
Scoped narrowly (only the autoDark-on branch) so every existing example
(all four set `autoDark: false` explicitly) compiles byte-identical output —
verified no example config opts in, so `check:fixtures`/`check:determinism`
baselines are untouched.

Verified end-to-end, not just at the IR boundary: probed a real
`css-variables` compile with `autoDark: true` and confirmed the dark block's
`--color-primary-solid` line now carries the `/* derived · color */` comment
that was previously only ever seen in the _light_ block — the concrete signal
`derivation.md` promised ("output classified `derived` in coverage so teams
see exactly how much of their dark theme is synthetic") now actually appears
in emitted output.

`TST1204` keeps firing regardless of `autoDark` — the color genuinely is
still the carried-over one either way, so the fact stays true — but its hint
now distinguishes the two states: without `autoDark`, "this is default
behavior, nothing is broken"; with it, "the carry-over is now classified
derived in coverage — but it does not yet compute a distinct color."

Corrected the same five docs pages (plus `roadmap.md`, moving the "audit
flow" half of the autoDark roadmap line to explicitly name `darkBrandAdjust`
as the remaining open half) from "not implemented at all" to "provenance
implemented; color synthesis remains an open, deferred research question."

`check:all` green at 63.
