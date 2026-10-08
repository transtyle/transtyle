# ADR-0009: Token sources stay pure DTCG; mode values and bindings may live in separate layers

**Status:** accepted; **amended 2026-10-08** (see [Amendment](#amendment-2026-10-08-an-overlay-claims-its-file))

## Context

The original config spec required mode values inline, via `$extensions["transtyle.modes"]` inside token files. A design system maintainer objected: the source-of-truth token files should not carry tool-specific annotations. The objection is only half-formal — `$extensions` is the DTCG-sanctioned mechanism and conformant tools ignore it — but it is fully _operational_: token files are frequently generated (Figma variables, Tokens Studio) and regenerated, wiping hand-added extensions; team ownership differs (designers own token values, platform engineers own transtyle wiring); and mode-per-file is how the ecosystem already organizes (Tokens Studio token sets, Style Dictionary common practice).

Separately, the Cathode example had conflated a DS's native vocabulary and its catalog bindings in one file, obscuring that the binding layer is transtyle-specific knowledge _about_ a design system, not part of it.

## Decision

The `tokens` manifest array accepts ordered **layers**: plain globs (base layers, merged) or `{ "files": …, "mode": { "<dimension>": "<mode>" } }` (mode-scoped layers — pure DTCG files whose values apply to one mode). Mode-scoped values are injected into the same internal structure that inline `$extensions` produce; **both authoring forms are equivalent by construction** and inline extensions remain fully supported. Catalog bindings need no new mechanism: they are pure DTCG alias files, separated by convention (`*.bindings.tokens.json`).

Precedence: later layers win; overriding an existing mode value emits a warning (`TST1108`); a mode value for a token with no default-mode value is skipped with a warning (`TST1107`); an undeclared mode is an error (`TST1109`).

## Consequences

- The recommended layout keeps every token file valid, tool-ingestible DTCG — source of truth (native values), per-mode overlays, bindings — with transtyle-specific syntax confined to the manifest. The [Cathode example](../../examples/cathode/) demonstrates it; restructuring Cathode from inline to layered form produced byte-identical compiled output, which is the equivalence claim made testable.
- Generated token files can be re-synced without losing mode data or bindings.
- Importers gain a natural output shape: emit a base layer per source, mode layers per theme.
- Cost accepted: two ways to author modes means both must be documented, tested, and supported forever; the mitigation is that they share one internal representation and one precedence model.
- Cost accepted: layer order in the manifest is now semantically significant — flagged clearly in [configuration.md](../specs/configuration.md#token-layering).

## Amendment 2026-10-08: an overlay claims its file

**What changed.** A file matched by a mode-scoped layer is that mode's overlay and nothing else: a plain glob that also matches it skips it, whatever the order of the two entries. Before, the loader walked the entries one by one and loaded every match, so `["tokens/*.tokens.json", { "files": "tokens/dark.tokens.json", "mode": { "color-scheme": "dark" } }]` loaded `dark.tokens.json` twice: as the overlay, and as a base layer merged after `base.tokens.json`. Every token in it raised `TST1103`, and its dark values replaced the light ones (light `text.base` on `elevation.1.surface` at 1.1:1). That config is the natural next step from the scaffold `transtyle init` writes (`"tokens/*.tokens.json"`), and the adoption guide showed it as written.

**Why order does not matter here.** "Later layers win" is about values: which of two definitions of a token is kept. Whether a file is an overlay at all is a different question, and the config already answers it the moment one entry names the file with a `mode`. Making the answer depend on whether the glob comes before or after that entry would give the same manifest two meanings, one of them a bug. So the loader collects the files of every mode-scoped entry first, then loads the plain globs without them.

**What is unchanged.** Precedence between layers, and every diagnostic: no new code fires for a skipped file, because loading it once, as the overlay, is what the config means. `TST1001` still means a glob matched nothing on disk (a glob whose only matches are overlays does not warn). A file matched by two mode-scoped entries still applies to both modes (`TST1108` where they collide), and a file matched by two plain globs is still merged twice (`TST1103`): both are spelled out in the config, unlike this case.
