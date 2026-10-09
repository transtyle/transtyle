# A one-token design system had a page but no text

Issue #116. `semantic.color.primary.solid` is the one token whose absence is an
error (`TST1201`), so a design system that authors nothing else is legal, and
since #23 ([worklog](2026-10-05-one-token-bootstrap.md)) every exporter builds
it. The engine gave it a page background on its own (`elevation.0.surface`,
rule `default-canvas`, `defaulted`) but no body text.

## The gap

Everything on the content side derives from `text.base`, behind `if (textBase)`
guards in `derive.js`. With no `text.base`, 14 slots per mode stayed empty:
`text.{base,muted,subtle,disabled,strong,inverse}`, `neutral.text-strong` and
the seven other built-in `<role>.text-strong`. The exporters left those
variables out and the target's stock palette filled in, so the theme was half
the design system's (brand, tints, surfaces) and half the framework's (body
text, emphasis, Bootstrap's `$dark`). On a light/dark one-token system, before
this change: shadcn reported `--foreground`, `--card-foreground`,
`--popover-foreground`, `--muted-foreground` and `--sidebar-foreground`
`unsupported`; daisyUI `--color-base-content`; ECharts `textStyle.color` and
the title/legend/axis label colors; Storybook `textColor`, `textMutedColor`,
`textInverseColor`, `barTextColor` and `inputTextColor`; Bootstrap dropped 23
variables (`$body-color`, `$body-emphasis-color`, `$body-secondary-color`,
`$dark`, the six `.dark` theme-map entries, their `-dark` and `--bs-*`
counterparts). css-variables, Radix and PrimeNG simply had nothing to emit.

## The fix

DERIVE fills an unauthored `text.base` per mode with rule `default-text`
(provenance `defaulted`, input `elevation.0.surface`): whichever of near-black
`oklch(0.145 0 0)` and white contrasts more with the mode's final page. The two
candidates are the two default canvases, so with both defaults in play a mode
gets the other polarity's page color: `#0a0a0a` on `#ffffff` in light, `#ffffff`
on `#0a0a0a` in dark, 19.8:1 either way. Against an authored page, it is the
better of the two.

The read of `text.base` moved below the elevation ladder, so the pick sees the
mode's settled canvas (authored or defaulted), and stays above the role grids,
which read it. Nothing downstream changed: the content ladder and every
`text-strong` derive from the default exactly as from an authored value.

- **Achromatic on purpose.** Tinting the default toward the page's hue would
  make it follow the user's tokens, which is what `derived` means. A pick
  between two catalog constants is honestly `defaulted`; the provenance
  paragraph of [derivation.md](../architecture/derivation.md#provenance-classes-and-the-defaulted-distinction)
  now says a default may be _chosen_ by its mode, as the canvas already was by
  polarity.
- **No diagnostic.** `default-canvas` emits none either; `explain` shows the
  rule and its input:

  ```
  semantic.color.text.base = oklch(1 0 0)  [#ffffff]
   └─ defaulted by rule default-text@standard@1
      inputs: semantic.color.elevation.0.surface = oklch(0.145 0 0)  [#0a0a0a]
       └─ defaulted by rule default-canvas@standard@1
  ```

- **Authored still wins, pending or not.** `resolve()` never fills a slot whose
  authored alias is still pending, so a `text.base` bound to a role cell keeps
  its alias, resolves after DERIVE and still raises `TST1205`. A dangling or
  cyclic `text.base` (`TST1105`, `TST1104`) stops the build before anything
  reads the default. A canvas that is itself a pending alias leaves nothing to
  pick against, so no default is written then.
- **One alias now settles in time.** A `text.base` bound to an elevation rung
  (`{semantic.color.elevation.0.surface}`) used to be read before the ladder
  existed and drew `TST1205`; it now resolves when DERIVE reads it, and the
  content ladder derives from it.

## Rule pack

The rule pack stays `standard@1`. [ADR-0010](../adr/0010-pre-release-breaking-changes.md)
(decision 3, kept by the 2026-08-30 amendment) lets rule semantics change in
place before the first non-prerelease version, with regenerated fixtures and a
worklog note; this is that note. [versioning.md](../architecture/versioning.md)'s
"new rule-pack version (`standard@2`)" is the discipline once the freeze is
armed, and now says so. No fixture moved: every example authors `text.base` in
every mode.

## The checks

`check:minimal-ds` holds the one-token fixture to the default in every combo of
its six mode shapes, with `autoDark` off and on: `text.base` is `defaulted` by
`default-text@standard@1` from `elevation.0.surface`, the page/text pair is
white/near-black one way or the other, `text.muted`, `text.subtle`,
`text.disabled`, `text.strong`, `neutral.text-strong` and `primary.text-strong`
exist, and no `TST2101` fires.

That took the one-token system off the absent-slot path #23 built in the
Bootstrap exporter (the `$dark` mix guard, the theme-map entry that keeps
Bootstrap's own `$dark-text-emphasis`). Those guards are still needed, so a
third fixture keeps them under test: `late-text` binds `text.base` to
`{semantic.color.neutral.solid}`, which is legal but read too late, so
`neutral.text-strong` and the content ladder stay empty while `text.base`
resolves. It runs through every invariant, must hold `text.base` as `aliased`
and `neutral.text-strong` absent in every combo, and its Bootstrap Sass output
is compiled against Bootstrap with `$theme-colors-text.dark` reported dropped.
The one-token Sass build must now report it present.

Verified red twice: with `derive.js` restored, 209 problems (every one-token run
missing its default text, and the one-token Sass build still dropping `.dark`);
with the default forced over a pending alias, every late-text run reports the
alias replaced and `neutral.text-strong` derived.

## Measured

On the light/dark one-token system, 229 resolved slots per mode become 243,
css-variables goes from 396 to 424 declarations, and the `dropped` and
`unsupported` rows above all turn into emitted values. What stays out is
`border`, which the engine never derives, authored or not: shadcn `--border`,
`--input`, `--sidebar-border`, daisyUI `--color-base-300`, ECharts' axis and
split lines, Storybook's `appBorderColor`, `buttonBorder` and `inputBorder`,
Bootstrap's `$border-color`, `$border-color-dark` and `--bs-border-color`.

Acme, Carbon, Cathode and GOV.UK compile byte-identical on every target,
`report.json` included: all four author `text.base`.

## Docs

Both derivation tables gain rows for `elevation.0.surface` (`default-canvas`,
undocumented until now) and `text.base` (`default-text`). The getting-started
table's "Why it can't be derived" column was wrong for four of its six rows and
is now "Why you author it", with a paragraph on what defaults. The homepage band
keeps "three" as the decisions that make a theme yours and calls one token the
floor. #23's examples of a slot left absent (`neutral.text-strong` without
`text.base`) moved to `border` and to a `text.base` bound to a role cell.

Out of scope: `transtyle init` keeps scaffolding `text.base` (a real design
system should author it), so the "11-token project" in
[ai-agents.md](../../website/src/docs/ai-agents.md) stays accurate; making the
scaffold optional or interactive belongs to #99. The launch post is frozen and
keeps its three-token wording.
