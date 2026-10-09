# ADR-0017: A mapping table may be an exporter, run by core's declarative runtime, not a core stage

**Status:** accepted

## Context

[ADR-0004](0004-plugin-packaging.md) wanted plugins to be mostly declarative mapping profiles, and [plugins.md](../architecture/plugins.md#trust-model) named a `declarative-only` plugin class "worth designing toward": loadable without executing code, which answers the trust question for community plugins. [ADR-0011](0011-v0-freeze-readiness.md) then found that no exporter used core-evaluated `mappings/*.json` tables and dropped them from the contract: every exporter owns its table and applies it in its own `emit`. So the smallest exporter is still a JavaScript package, and a team that wants `our-internal-lib.css` with its own variable names has to write and publish code ([issue #82](https://github.com/transtyle/transtyle/issues/82)).

## Decision

A **declarative mapping** (`*.mapping.json`, [spec](../specs/declarative-mapping.md)) is an exporter. Core ships the runtime (`packages/core/src/declarative.js`): `createDeclarativeExporter(mapping)` returns an ordinary `{ name, emit }` plugin that resolves each row against the IR it receives, formats values with the same colour helpers every exporter gets on `ctx`, and derives the coverage report from the rows.

- **Not a pipeline stage.** The runtime is called through the same one-hook interface as any exporter, after RESOLVE, with the same immutable IR and `ctx`. ADR-0011's reconciliation stands: core does not evaluate exporters' tables. A mapping is a whole exporter whose code happens to be shared.
- **The mapping file is the exporter.** A target points at it with `"exporter": "./ourlib.mapping.json"` (a path ending in `.json`, resolved next to the config); `options` stays free for real knobs (decided on the issue, 2026-10-07). An npm package can ship one instead of code: its manifest says `"declarative": "<file>"`, and the loader reads that file and never imports the package.
- **Validated like config.** A malformed table is `TST1014` and a row naming a slot neither the catalog nor the design system has is `TST1015`, each with the row's path, before any `emit` runs. The format is published as `schemas/mapping/v0.json`.
- **v0 is rows, not rules.** Files of four templates (CSS custom properties, Sass, Less, flat JSON), rows `{ variable, slot, part?, format?, class?, note? }`, a base mode per file and selector blocks per mode value. No conditions, expressions, value arithmetic or naming patterns: past that line an exporter is code.
- **Core, not a new package.** The runtime is one module with no dependency, and core is where `compile()` resolves a mapping path. A separate `@transtyle/exporter-declarative` would be one more package to publish for no separation gained.

## Alternatives not taken

- **`"exporter": "declarative", "options": { "mapping": … }`** (the issue's first proposal). Rejected: an exporter has no filesystem access, so a file-valued option has nobody to read it; the table would have to live inline in `transtyle.config.json`.
- **Core-evaluated tables as a pipeline stage** (the pre-ADR-0011 design). Rejected again for the reasons ADR-0011 records: exporters written against the real interface never needed the split, and coverage stays honest only where the code that maps also reports.
- **Naming rules (`semantic.color.{role}.solid` → `--{role}`).** Deferred: rules are code by another name, and the open-set catalog (custom roles, [#51](https://github.com/transtyle/transtyle/issues/51)) is where they'd be needed. css-variables, which walks every slot, stays code.

## Consequences

- One trust class is real: a declarative package runs no code at build time. `plugin-kit` runs a mapping unchanged (`conformance(createDeclarativeExporter(mapping))`).
- The proof is executable: a reference mapping, generated from `exporter-css-variables`' own coverage on plugin-kit's canonical fixture, reproduces its stylesheet byte for byte (`check:plugins`); a fixture package whose `main` throws is `npm pack`ed, installed and built (`check:cli`). Writing it found that css-variables left `palette.categorical.*` out of its dark block (it chose the block by path, not by type); fixed in the same change.
- `transtyle add <npm package>` (install, print the manifest, say "no code will run" for a declarative package) is still a separate feature: the CLI's `add` takes official target names only.
- Two diagnostic codes are appended (`TST1014`, `TST1015`) and one schema is published.
