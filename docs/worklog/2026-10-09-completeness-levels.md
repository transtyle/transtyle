# Completeness levels: what to author next

Issue [#67](https://github.com/transtyle/transtyle/issues/67). The derivation
page and the adoption guide carried the advice in prose ("brand, neutrals, dark
neutrals, radius, fonts", "most systems settle around 40–60 % authored"), and
nothing in the tool said which slot to author next. Three levels now do, as data
in `packages/core/src/completeness.js`: `minimal` (the brand), `recommended`
(neutrals, their dark values, radius, fonts) and `complete` (second brand
color, status roles, ring, scrim, the space and type scales, the control
geometry).

## Naming

The issue called them profiles. In Transtyle a profile is already a target
mapping profile (ADR-0006, `versioning.md`, the shadcn page's era profiles, and
a specced `build --force-profile`), so `check --profile` and `build
--force-profile` would have meant two unrelated things. They are **completeness
levels**: `check --completeness <level>`, `check.completeness`,
`require: ["completeness:<level>"]`.

## What was measured

Compiling the four examples and a one-token project (`primary.solid` only,
light + dark) before writing any code, as the issue's refinement did:

- **"Authored" has to include `aliased`.** Every example binds its semantic
  tier to its own vocabulary; counting only `authored` would have reported Acme
  as having authored almost nothing. The predicate is the one
  `check-doc-numbers.mjs` already counts as written.
- **Absence is a state.** `border`, `radius.md` and the fonts have no rule; a
  project that doesn't author them simply doesn't have them. The to-do has
  four states: `missing`, `derived`, `defaulted`, `carried-over`.
- **A dark value can't be read from `provenance.kind`.** A light value carried
  into dark keeps `kind: authored`. The test is the one `TST1204` applies, so it
  moved out of `reportModeCarryOver()` into `carriesOver()` (`normalize.js`) and
  both use it: authored on the slot for that scheme, or bound and resolving to
  a different value there. A bound neutral whose alias target has its own dark
  value counts; one whose target has none is carried over.
- **No example satisfies `complete`.** Acme reports 15 of 24, its to-do being
  exactly secondary, the four status roles, ring, scrim, `type.*` and
  `component.control.*`; cathode 16, govuk 11 of 19 (no `color-scheme`
  dimension, no `font.mono`), carbon 20. Every example satisfies `recommended`
  except govuk's `font.mono`.

## The `require` defect

`derivation.require` only failed on `derived` or absent slots: with
`"require": ["semantic.space.4", "semantic.color.elevation.0.surface"]` on the
one-token project, both `defaulted`, nothing fired, though the diagnostics
page said `TST1202` fires when a required token "was derived, not authored".
`require` now uses the same predicate as the levels: anything but `authored` or
`aliased` fails, and the message says which state it found. No example
requires a defaulted slot, so none changes.

## Choices

- **A family is one item.** `space.*` (13 slots), `type.*` (36) and
  `component.control.*` (3) count once, satisfied by one authored member; the
  to-do says `k/n authored`. Members are read off `catalog()`, so a new slot
  joins its family without an edit here. Counting members would have put about
  70 items in `authored n/m` and drowned the colours.
- **One policy mechanism.** The issue proposed both `check.profile` "as
  policy" and `derivation.require` taking a profile name. Only the second fails
  a build (`TST1202`, one code, works for `build` too); `check.completeness`
  only picks the level the summary line and `check --json` report on. No new
  diagnostic code.
- **The summary line is printed once**, before the per-target coverage bars:
  authoring doesn't depend on the target. `report.json` doesn't carry it (out
  of scope in the refinement, and it would be the same in every target's
  report).
- **Guard.** `check:grid` fails when a level names a slot `catalog()` doesn't
  have or a family with no member. Broken on purpose (`semantic.color.focus-ring`,
  `semantic.typo`) and restored. The new `<example>.completeness.<level>[.total]`
  metric puts the counts the docs quote under `check:doc-numbers`, which now
  reads the example READMEs too.

## Not done

- `init`'s closing "worth authoring next" list stays hand-written; it now
  points at `check --completeness` for the ordered list.
- `size.control.*`, `border-width.*`, motion and z-index scales are in no
  level: the issue didn't name them, and nothing in the examples says a team
  should decide them before the ones above.
