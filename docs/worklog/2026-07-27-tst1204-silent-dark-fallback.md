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
the whole compiler, inside that same hint string, to decide what to *say*, never
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
non-default `color-scheme` value, and the base token *is* authored somewhere
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
