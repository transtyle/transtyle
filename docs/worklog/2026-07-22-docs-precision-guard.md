# Worklog — docs-precision guard (`check:docs`)

**Task:** the "website stays precise forever" half of the Part-3 docs assignment (strategic review; precedes D1). New `scripts/check-docs.mjs`, wired into `check:sync` (and thus `check:all`/CI): nav↔files completeness, internal link + anchor resolution (GitHub-slugger ids, verified against built HTML), CLI `COMMANDS` ↔ `cli.md` exact match both directions, diagnostic codes in package sources ↔ `diagnostics.md` both directions (table rows).

**Drift found and fixed on first run:** 12 genuinely broken anchor links across 10 website pages — every em-dash heading ("Cathode — the hostile example") produces a double-hyphen id (`#cathode--the-hostile-example`) but the links used single hyphens; live-site anchors silently scrolled nowhere. One `cli.md` Specced row (`explain --target`) now carries an explicit "(new flag)" qualifier so it can't read as the bare implemented command.

**Deviation note:** the strategic review's D-tasks didn't name this guard; it was added per the maintainer's direct instruction ("make sure the website will always be updated precisely") and CONTRIBUTING's standing "extend the checker whenever a new class of drift is discovered" rule. CONTRIBUTING documents the new guard.
