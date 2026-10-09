# `$description` and `$deprecated` reach the outputs

Issue [#30](https://github.com/transtyle/transtyle/issues/30), following its refinement.
Both DTCG fields loaded without complaint and stopped at `collectTokens`, which
kept only `type`, `value` and `modeValues`. A deprecated token kept compiling into
every target with nothing saying so, and GOV.UK's and Carbon's binding files, which
explain each binding in a `$description`, shipped bare variables.

## What changed

- `collectTokens` (`@transtyle/ir`) carries `description` and `deprecated`, with the
  group inheritance and `false` opt-out of DTCG 2025.10 §6.3.1; NORMALIZE copies them
  onto every mode's entry, where they survive the alias rewrite (the entry is mutated
  in place).
- `TST1122` (warning): a catalog slot reaching a deprecated token, walked through the
  full alias chain and composite members after the deferred aliases resolve, once per
  (slot, token). `TST1311` (warning): malformed metadata, ignored.
- Core enriches `report.json` items (`description`, `deprecated`, `deprecatedBy`) and
  appends the "Deprecated tokens" section to every target's `usage.md`, the way it
  already appends the per-target modes note.
- css-variables, shadcn, daisyUI and Bootstrap (theme colours) write the slot's own
  notes as comment lines above the declaration, in the default mode's block only.
- `explain` prints `description:` / `deprecated:` and `via deprecated <token>`.

## Deviations from the refinement

- **Codes.** The refinement named `TST1113` and `TST1307`; both were taken by the
  time this landed (tier violations, Style Dictionary detection). The deprecation
  warning is `TST1122`, the next free 11xx code. The malformed-metadata warning is
  `TST1311`: `TST1309` and `TST1310` went to the plugin-manifest check (#190)
  while this was open, so it takes the next free code after a rebase.
- **usage.md in core, not in each exporter.** The refinement put a shared helper in
  `@transtyle/ir` for each of the eight (now ten) `renderUsage` functions. Core already
  post-processes `usage.md` for per-target mode subsets, and doing the same here
  gives the section to third-party exporters too, with no change to any of them.
- **`deprecatedBy` on report items.** The refinement had `deprecated` only. An item
  whose value comes through a deprecated option token is not deprecated itself, so
  the field says which token is, and `deprecated` is set for the whole chain rather
  than for the slot alone, matching what `usage.md` and `TST1122` report.
- **css-variables keeps its own helper.** It is the dependency-free reference
  implementation of the plugin API; importing `@transtyle/ir` for two lines would
  have been its first dependency.
- **Bootstrap** writes notes on the six theme colours only: the other declarations
  map several slots, an exporter-private mix, or a pseudo-role.

## Measured

Acme and Cathode build byte-identical to `main` (they author no metadata). GOV.UK
and Carbon gain comment lines in their css-variables, shadcn, daisyUI and Bootstrap
Sass files, and `description` keys in their `report.json` items; no declaration
changes. `check:cli` covers the acceptance on a scaffold project (a `*/` and a
second line in a description stay inside the comment in CSS and Sass, and the Sass
still compiles), `check:explain` covers the chain walk.

## Not done

`transtyle diff` still compares values and provenance only, so a description or
deprecation change shows in a target's changed lines but not as a slot change. The
TypeScript/JSON targets (Chakra, Mantine, PrimeNG, Storybook, ECharts) and Radix
write no comments.
