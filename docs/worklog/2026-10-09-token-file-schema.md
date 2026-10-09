# A JSON schema for token files

Issue [#64](https://github.com/transtyle/transtyle/issues/64). The config had a
published schema with editor autocomplete; token files, where the whole catalog
is the authoring surface, had none, so `semantic.color.primary` (a different
slot from `.solid`) and a typo like `primary.solidd` passed an editor unnoticed.

## What was done

- `packages/core/src/schema/token.schema.js` builds the schema from the catalog.
  `catalogSlots()` compiles a minimal in-memory design system (the slots DERIVE
  cannot invent: one `primary.solid`, `elevation.0.surface`, `radius.md`, the
  three fonts) and reads back every slot DERIVE materializes, plus the
  authored-only ones from the IR constants (`TEXT_RUNGS`, grid cells,
  `COMPONENT_CATALOG`, `semantic.color.border`). 258 slots today. A slot added
  to DERIVE shows up on the next `npm run gen:schemas`; nothing is listed by hand.
- `scripts/gen-schemas.mjs` publishes it as `website/public/schemas/tokens/v0.json`.
- `validate.js` learned local `$ref` / `$defs`, a recursive token-file schema
  needs them. About ten lines, same zero-dependency subset.
- `check:schemas` also proves: all 12 example token files validate (Cathode's
  `crt.*` included), five known-bad documents are rejected, three custom-token
  documents are accepted, every catalog slot is offered as an alias completion.
- `transtyle init` writes `$schema` into the scaffolded token file.

## Deviations from the issue and its refinement

- #65 (`catalog()`) has not landed, so the catalog is read through the compiler
  as above instead of exporting the private scales from `derive.js`. When #65
  lands, `catalogSlots()` should become a call to it.
- Groups directly under `semantic`, `semantic.color`, `semantic.font` and
  `component` stay open so custom tokens validate (Cathode's `crt.*` and
  `crt-amber`, GOV.UK's `semantic.font.transport`). So the misspelled _role_ case
  from the issue's acceptance line cannot be flagged; everything inside a
  built-in role or ladder is. Documented on the configuration page.
- Not measured in a real editor: the VS Code behaviour is checked through the
  validator, not by driving VS Code.
