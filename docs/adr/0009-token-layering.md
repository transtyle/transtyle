# ADR-0009: Token sources stay pure DTCG; mode values and bindings may live in separate layers

**Status:** accepted

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
