# T11 review checklist — GOV.UK & Carbon real-DS run

Per `docs/plan/catalog-revision.md` T11: *"a review checklist per target filled by a human practitioner (the maintainer)."* Everything below the line is engine-side verification already performed (builds, diagnostics, determinism, in-browser screenshots) — see [`govuk-adoption.md`](govuk-adoption.md) and [`carbon-adoption.md`](carbon-adoption.md) for the full reasoning behind every binding decision. This document is the **human** half: a practitioner's judgment on whether the rendered output actually looks right for each framework, which an automated check can't fully stand in for.

**How to use this**: run each demo (`npm run dev -w <example>-demo-<target>`, ports listed in each example's README), look at it, and mark PASS / CONCERNS for each row. This file isn't meant to gate anything mechanically — check it in once reviewed, with notes on anything that needs a follow-up.

## GOV.UK (`examples/govuk/demo/`, ports 4301–4306, 6301)

| Target | Port | What to look for | Result |
|---|---|---|---|
| Bootstrap | 4301 | Flat (0-radius) buttons/cards/inputs match GOV.UK's real aesthetic; blue primary reads correctly in both filled and outline variants | ☐ |
| daisyUI | 4302 | Theme block registers correctly; brand-direct `secondary`/`accent` (daisyUI convention) don't look wrong even though GOV.UK doesn't distinguish them from `primary` | ☐ |
| shadcn/ui | 4303 | Registry components (Dialog, Select, etc.) render with GOV.UK blue; focus rings show the yellow `ring` binding on interactive elements (tab to a button to check) | ☐ |
| ECharts | 4304 | Chart palette derived from GOV.UK blue looks coherent, not garish | ☐ |
| Storybook | 6301 | Chrome (sidebar/toolbar/Controls) themed correctly; single-mode config doesn't break the toolbar's mode switcher (it should just have nothing to switch to) | ☐ |
| css-variables | 4305 | Full catalog browses cleanly by family; spot-check a few hex values against the live GOV.UK colour page | ☐ |
| Radix | 4306 | `blue`/`gray` preset override renders GOV.UK blue in real `@radix-ui/themes` components | ☐ |

## Carbon (`examples/carbon/demo/`, ports 4401–4406, 6401)

| Target | Port | What to look for | Result |
|---|---|---|---|
| Bootstrap | 4401 | Both light and dark (`data-bs-theme`) look like real Carbon, not a generic dark mode | ☐ |
| daisyUI | 4402 | White and G100 theme blocks both register; toggle between them | ☐ |
| shadcn/ui | 4403 | Registry components in both modes; IBM Plex Sans renders (check via devtools computed font, not just visually) | ☐ |
| ECharts | 4404 | Both mode themes look distinctly Carbon (Blue 60 light / Blue 40 dark) | ☐ |
| Storybook | 6401 | Chrome themes correctly in both modes via the toolbar switcher | ☐ |
| css-variables | 4405 | Full catalog browses cleanly; spot-check `--color-*` dark values against Carbon's G100 token page | ☐ |
| Radix | 4406 | `indigo`/`gray` preset override; dark mode shows real G100 background + Blue 40 primary (already screenshot-verified during engineering — worth a second look) | ☐ |

## Open items from the findings ledger worth a maintainer opinion

- [ ] GOV.UK: is Black tint-50 (#858686) the right `neutral` anchor, or would tint-25 read better in practice? (`govuk-adoption.md`)
- [ ] GOV.UK: is purple (#54319f) an acceptable `link.visited` given it's not in GOV.UK's current functional-colour set? (`govuk-adoption.md`)
- [ ] Carbon: should `secondary`'s G100 value be independently re-verified against a live Carbon page before this ships anywhere real? (`carbon-adoption.md`)
- [ ] Both: is leaving `warning`/`info`/`secondary`/`accent` (GOV.UK) unbound-and-derived the right call, or should a real GOV.UK adoption bind them to something GOV.UK-specific even without an official functional colour?

## Sign-off

- [ ] Reviewed by: _______________ Date: _______________
- [ ] All rows above are PASS, or concerns are filed as follow-up issues (not blocking)
- [ ] ROADMAP.md's T11 line and Phase 1 exit criterion may be flipped to `[x]` once this is checked
