# Worklog — website rework, maintainer feedback round

Six items from the maintainer's review, all addressed:

1. **Homepage pipeline schema** — compiler jargon demoted: columns now lead with "You write / Transtyle compiles / You ship" (jargon as small mono tags), each with a plain-language note line.
2. **"Author 11 tokens" limiting** — reframed as floor-not-ceiling: "Author 11 tokens — or every single one." Copy now states every derived slot is a real addressable token (full role grids, elevation ladder, scales) that authoring overrides.
3. **Missing visual token→output representation** — new "Same tokens. Native everywhere." band: one token definition + four target previews (Bootstrap, shadcn dark, daisyUI, ECharts bars) styled with the actual compiled Acme values, each in its target's own idiom (Bootstrap's 0.375rem radius vs the authored 0.5rem, daisyUI's danger→error name translation). Links to the runnable demo projects.
4. **/docs overview schema** — replaced the cramped `.flow` groups with a `.schema` three-column write→compile→ship diagram (plain kickers + sub-lines; stacks vertically on mobile).
5. **Color representation ugly** — `.pal` strips on the overview replaced with `.swatches` labeled cards (swatch + slot name + derivation note/hex). `.pal` retained only on language.md where a continuous ramp reads as a ramp.
6. **Mode files as default** — separate pure-DTCG mode-scoped files are now the documented recommended layout everywhere: authoring-tokens.md (reordered, rationale added), adopt-existing.md §2 (example restructured around a dark.tokens.json + config scope), getting-started.md (pointer aligned). Inline `$extensions` demoted to the small-hand-edited-systems alternative.

Bonus drift found while editing: adopt-existing.md §3's binding example still used pre-revision vocabulary (`primary.base`, `background`, `border.base`) — fixed to `primary.solid` / `elevation.0.surface` / `border`.

Verified in live preview: new bands/diagrams/swatches render, zero console errors; site build + check:docs + check:sync + check:all green.
