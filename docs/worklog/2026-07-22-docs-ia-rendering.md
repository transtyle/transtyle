# Worklog — D1: website IA restructure + rendering upgrades

**Task:** D1 (docs/plan/execution-2026-h2.md), plus rendering improvements folded in.

- `nav.js` restructured into six labeled sections — Start here / Concepts / Guides / Reference / Targets / Project (the plan said "four kinds"; Targets and Project are kept as their own sections because eight exporter pages would drown a generic Reference list — deviation recorded, spirit intact). No slugs changed, so no URLs moved and no redirect map was needed.
- `[...slug].astro`: prev/next pager derived from `orderedSlugs` (first/last pages verified one-sided in built HTML); right-rail "On this page" TOC from `getHeadings()` (h2–h3, hidden ≤1180px); scrollspy via a passive scroll listener — deliberately not IntersectionObserver, whose callbacks proved unreliable under automation and whose failure mode is silent.
- Verified on the dev server: six sections render, TOC anchors all resolve to real ids, active-link highlight and scrollspy update correctly, zero console errors; `check:docs` + `check:sync` + site build green.
- `.claude/launch.json` gained a `website` entry (port 4321) so the docs site is previewable like the demo apps.
