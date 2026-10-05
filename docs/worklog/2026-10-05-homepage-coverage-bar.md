# The homepage coverage bar hid the dropped class

Issue [#111](https://github.com/transtyle/transtyle/issues/111). The homepage
showed Acme's shadcn coverage twice and the two disagreed. The hero transcript
quotes the CLI (`42% native · 53% derived · 3% approximated · 3% dropped`, which
sums to 101 because the CLI rounds each class on its own, and
`check:doc-numbers` holds it to a fresh compile). The "Honest about lossiness"
bar under it drew three hand-typed segments, `42%`, `53%` and an unlabelled `5%`:
approximated and dropped fused, in the approximated colour. The one section
about honest numbers hid a class.

## The defect

`check:doc-numbers` reads transcripts and `.covmatrix` blocks in Markdown. The
bar is Astro markup with inline widths, so no checker saw it.

## The fix

- `website/src/demo-themes.js` already compiles each example once per build for
  the gallery; it now also returns per-target coverage counts from that compile.
- The bar draws four segments from those counts (native, derived, approximated,
  dropped in the grey `.covmatrix` uses), the legend names all four, and a line
  under the bar prints the exact counts: 15 native, 19 derived, 1 approximated,
  1 dropped, of 36.
- The derived-CSS sample's `AA ✓` comment is now the computed WCAG ratio of
  `--primary-foreground` on `--primary` for Acme's light pair (`4.9:1`), taken
  with `contrastRatio` from core.

Because the page reads the compile, a change to Acme's coverage moves the bar
instead of leaving it stale. The hero transcript stays typed on purpose: it is
the CLI's own output and `check:doc-numbers` keeps it honest.

## Measured

Fresh compile of `examples/acme`, shadcn target: 36 rows, 15 native, 19 derived,
1 approximated, 1 dropped. Built page: bar widths 41.7 / 52.8 / 2.8 / 2.8 %.
