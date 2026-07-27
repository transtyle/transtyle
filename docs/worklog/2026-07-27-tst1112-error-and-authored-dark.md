# Promoting TST1112 to an error, and sweeping authored dark across mode shapes

Two follow-ups on the mode-shape harness, both about the same failure class: a
design system whose dark mode is silently wrong.

## TST1112 is now a build error, not a warning

`TST1112` fires when `color-scheme` is declared but isn't the first mode
dimension. The engine binds light/dark to the _first_ dimension (`derive.js`
keys `isDark` off `modeDimension`, and the `modes.light`/`modes.dark` aliases
exporters read exist only for the primary dimension's values), so a later
`color-scheme` produces a dark block filled with **light values** on every
exporter. The dark values still resolve into their combos; no target ever reads
them.

It shipped as a warning. That was too soft: the output is _guaranteed_ wrong,
and the default `check.failOn: error` lets a warning through — so the one thing
the diagnostic exists to prevent (silently-wrong dark mode reaching a build)
still happened. This is the exact AL5 failure class, where "silent plus wrong"
is treated as worse than a crash. So it's an **error** now: the build stops, and
the only fix (reorder `modes`) is in the hint.

Two things made this safe to harden rather than just flip:

- **Narrowed the trigger.** It now also requires `color-scheme` to carry more
  than one value. With a single value there is no non-default scheme to drop, so
  nothing is actually wrong — erroring there would have been a _false_ build
  failure, and the old message ("dark mode will not reach any exporter") was
  itself false when there was no dark to begin with. Now it fires exactly when
  there is a real non-default scheme being silently dropped.
- **There is no "make it work" alternative.** Even if the alias pointed at the
  right combo, `isDark` stays false for a non-primary `color-scheme`, so derived
  dark values (hover states, elevation, on-colors) would compute as light. The
  whole engine assumes polarity is the first dimension; the honest move is to
  refuse the config, not half-honor it.

Documented on the diagnostics page (severity `error`) and in `configuration.md`,
where the "first dimension carries light/dark" constraint now says the build
stops rather than warns. The harness's negative-space case asserts the code lands
in `diagnostics.errors` specifically — verified by reverting to `warn` and
watching the harness name the gap.

## Authored dark, swept across the shapes

The mode-shape harness varied _which modes exist_ but always compiled the
all-light three-token floor. With `autoDark` off and no dark authored, the dark
map's anchor slots (surface, text) fall back to their light values — so the dark
block an exporter emits carries a **light canvas**, and everything derived from
that canvas (text-muted/subtle/inverse, on-colors, contrast pairs) is computed
against a light anchor even in dark mode.

Worth being precise about what this did and didn't miss: the `isDark` role grid
runs regardless (a dark-adjusted accent/neutral ladder is emitted even with a
light surface), so the dark block was never _empty_. What never ran was
derivation against a genuinely dark **authored** canvas. The harness now authors
a distinct dark surface (`#101114`) + text for every shape whose `color-scheme`
has a non-default `dark` value (`light-dark`, `three-scheme`, `two-dimension`),
via a mode-scoped layer placed outside the base glob so it's never swallowed as a
base layer. Shapes with no non-default dark (`light-only`, `dark-only` where dark
is the default, `density-only`) get no dark layer — a dark-scoped file there is a
`TST1109` or dead weight, not a test.

The four existing invariants (no crash, no leaked JS value, no empty file,
coverage honesty) now cover that path, and a fifth assertion checks the authored
dark surface distinctly reached `modes.dark` — guarding the sweep's own premise,
so a future glob/layer regression that silently swallows the dark layer (dark ==
light again) fails loudly instead of quietly becoming a no-op. Verified it bites
by making the dark anchor equal to light and watching every exporter's row fail.

`check:all` green at 63.
