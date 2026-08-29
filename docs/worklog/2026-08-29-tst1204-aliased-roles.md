# TST1204 judged the token text, not the colour

Follow-up to [2026-07-27-tst1204-silent-dark-fallback.md](2026-07-27-tst1204-silent-dark-fallback.md),
found while re-measuring documentation claims rather than by reading code: the
docs said GOV.UK and Carbon compile "with zero diagnostics", and Carbon printed
seven `TST1204` notes. Checking whether the docs or the compiler was wrong
turned out to be the interesting question.

## The defect

`TST1204` says a role's dark-mode colour is the light one, carried over. It was
emitted inside NORMALIZE's per-mode expansion loop, on this condition:

```js
const override = tok.modeValues?.[dimName]?.[v];
if (override !== undefined) {
  /* … */
} else if (dimName === 'color-scheme') {
  /* → TST1204 */
}
```

That tests whether the **catalog slot itself** carries a per-mode value. For a
design system adopted through the binding layer — the pattern
[`adopt-existing.md`](../../website/src/docs/adopt-existing.md) recommends, and
the one both real examples use — it never does. Carbon binds:

```json
"danger": { "solid": { "$value": "{semantic.color.carbon.support-error}" } }
```

The alias string is identical in light and dark. The _target_ is what carries
`$extensions."transtyle.modes"."color-scheme".dark`, and aliases resolve after
this loop. So the check saw "no per-mode value" and reported a silent
carry-over, while the emitted dark theme was a genuinely different red.

Measured on the committed output, before the fix:

| Role      | light                      | dark                       | Old TST1204 |
| --------- | -------------------------- | -------------------------- | ----------- |
| primary   | `oklch(0.557 0.243 262)`   | `oklch(0.736 0.136 261.1)` | wrong       |
| danger    | `oklch(0.569 0.217 25.9)`  | `oklch(0.666 0.209 22.1)`  | wrong       |
| success   | `oklch(0.623 0.166 148.1)` | `oklch(0.712 0.168 149.3)` | wrong       |
| info      | `oklch(0.454 0.221 262.6)` | `oklch(0.647 0.189 260.6)` | wrong       |
| secondary | `oklch(0.345 0 0)`         | `oklch(0.345 0 0)`         | correct     |
| warning   | `oklch(0.832 0.166 90.4)`  | `oklch(0.832 0.166 90.4)`  | correct     |
| neutral   | `oklch(0.542 0 0)`         | `oklch(0.542 0 0)`         | correct     |

Four of seven wrong on Carbon, plus Cathode's `primary` (bound to `crt.ink`,
which the light overlay redefines to paper ink — a full polarity flip reported
as "unchanged"). The failure mode is the worst kind for a trust-first tool: the
compiler telling a correctly-authored system that its theming is broken.

## The fix

`reportModeCarryOver()` in `normalize.js`, called from `index.js` after
`resolveDeferredAliases()`. It compares **resolved values** between each
non-default `color-scheme` combo and its default-scheme sibling, and reports
only when they're actually equal. Three conditions, each load-bearing:

1. **No per-mode value authored on the slot itself.** An explicitly authored,
   deliberately identical dark value is a decision, not an oversight — kept from
   the old implementation via `provenance.mode`, which alias resolution
   preserves.
2. **Resolved colours equal.** The new half; the whole defect.
3. **Provenance `authored` or `aliased`.** Running after DERIVE means every
   _derived_ role anchor is in the map too — `accent.solid` aliasing primary,
   `danger.solid` hue-anchored from it — and each carries over for one reason:
   the authored anchor did. Without this, Acme's single note became eight
   consequences of one cause, exactly the noise AL5 removed elsewhere.

Result: Carbon 7 → 3 notes, Cathode 4 → 3, Acme 1 → 1, GOV.UK 0 → 0. No emitted
value changes; `report.json`'s diagnostics array does.

## The guard

`check:minimal-ds` gained a binding-layer fixture: two roles bound to a private
vocabulary, one whose target has a dark value and one whose target doesn't.
Exactly one note is expected, on the second. Verified by reverting the core fix
with the check in place — it fails with the right message. The fixture also
asserts its own non-degeneracy (the bound primary must actually resolve
differently per mode), so it can't quietly stop testing anything.

## What this says about the checks

Nothing in `check:all` could have caught this, and the reason is worth writing
down: every check runs against the four examples and asserts they _build_, not
that what the compiler _says about them_ is true. The diagnostic was consistent
with itself, stable, deterministic, and wrong. It was found by comparing a
sentence in the docs against a command's output — the same way the coverage-matrix
drift was found the same day. The lesson isn't "write more checks"; it's that
prose claims re-measured against the tool are a real test surface, which is now
partly mechanized in `scripts/check-doc-numbers.mjs`.

## Left alone, deliberately

With `autoDark` on, an _aliased_ carry-over stays `aliased` in provenance rather
than being reclassified `derived` — so it doesn't get autoDark's coverage-honesty
treatment the way an authored one does. That's a separate design question about
what provenance should say when a value arrives through a binding, not part of
fixing a false positive.
