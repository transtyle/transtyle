# Worklog — website rework: precise content, visual diagrams, a11y

**Assignment:** full rework of website rendering + content (maintainer instruction, extends Part 3 / D-tasks; designed per the artifact-design skill's fundamentals).

**Design decision:** the site's visual language is now the product's own trust model — the coverage trio (native green / derived blue / approximated amber) is tokenized (`--cov-*`) and used consistently across every diagram, chip, and swatch; JetBrains Mono is the "compiler voice" (tokens, slots, labels), Inter the explaining voice. Existing OKLCH palette honored, `--text-muted` darkened slightly for AA headroom.

**Content precision fixes (all verified against source):**

- Homepage + docs overview claimed **5 exporters; 8 are shipped** — both now enumerate all eight, and `check-docs.mjs` §5 enforces this permanently against `OFFICIAL_EXPORTERS`.
- getting-started claimed "no `transtyle init` yet" — **false since T6**; §4 now teaches the real `init` scaffold, and its token example used **dead pre-revision vocabulary** (`primary.base`, `background`) — now the real catalog names (`primary.solid`, `elevation.0.surface`, `text.base`).
- `cmdInit`'s next-steps message listed 5 targets — now derived from `OFFICIAL_EXPORTERS` at runtime, can't drift.
- Homepage "One meaning, every dialect" band: every mapping verified in exporter source (caught myself writing daisyUI v4's `--er`; it's `--color-error`).
- Status callout rewritten: implemented vs specced now truthful (8 exporters, build/check/explain/init/add live; diff/import/preview specced).

**New comprehension visuals** (theme-aware HTML/CSS components in global.css, composable from markdown): `.flow` (pipeline diagrams — used for the six stages and the frontends→IR→backends map), `.tiers` (three-tier model, public tier highlighted), `.paths` (three entry-path cards on the overview), `.prov` chips (authored/derived/approximated, always the same colors), translation band on the homepage showing `danger.solid` → each target's dialect.

**A11y:** skip-to-content link, global `:focus-visible` treatment, `aria-current="page"` on header + sidebar nav, `prefers-reduced-motion` respected, terminal `role="img"` removed in favor of real readable text, decorative arrows `aria-hidden`, palette labels given text-shadow for contrast.

**Guard extensions (check-docs.mjs):** §5 overview surfaces must name every registry exporter; §6 no docs page may describe an implemented CLI command as unimplemented (the exact class of both falsehoods found today).

**Verified:** site builds; check:all green (incl. CLI golden tests); homepage/overview/concepts inspected in the live preview — diagrams render, aria-current present, dark-theme tokens resolve, zero console errors. Astro gotcha for the record: `{light,dark}` in a template is parsed as an expression — escape as `{'{light,dark}'}`.
