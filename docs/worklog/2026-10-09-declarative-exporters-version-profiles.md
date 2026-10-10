# Declarative exporters and version profiles

Issues [#82](https://github.com/transtyle/transtyle/issues/82) and
[#83](https://github.com/transtyle/transtyle/issues/83), built together because
both live where an exporter is loaded: the manifest a declarative package
carries is the one whose `targets` ranges a requested version is matched
against.

## What was done

**Declarative exporters (#82, [ADR-0017](../adr/0017-declarative-exporters.md)).**

- `packages/core/src/declarative.js`: the runtime. `createDeclarativeExporter(mapping)`
  returns a plain `{ name, emit }`; `validateMapping` (schema plus what a schema
  can't say), `unknownMappingSlots` (against the catalog and the IR, so custom
  roles pass), `readMappingFile`, `loadDeclarativePackage(dir)`. The format's
  schema is `packages/core/src/schema/mapping.schema.js`, published by
  `gen:schemas` as `schemas/mapping/v0.json`. Spec:
  [declarative-mapping.md](../specs/declarative-mapping.md).
- `compile()` reads a target whose `exporter` is a path ending in `.json` itself
  (the refinement's question 2, answered "the mapping file is the exporter"),
  then refuses a bad table before `emit`: `TST1014` per problem with the row's
  path, `TST1015` per unknown slot with the nearest name.
- The CLI loader finds a package's directory through `require.resolve.paths`
  before resolving its entry, and when the manifest has `declarative` it reads
  the mapping and returns; nothing is imported.
- Proof: `scripts/gen-reference-mapping.mjs` writes css-variables' output on the
  kit's canonical fixture as a 305-row table, from its own coverage;
  `check:plugins` runs it through the kit (all checks pass) and requires the
  stylesheet byte-identical and the coverage rows equal. A fixture package
  (`packages/core/test-fixtures/declarative/package/`, a `main` that throws) is
  `npm pack`ed and installed into a scratch project by `check:cli`, which then
  builds it; a project-local mapping, `TST1014`, `TST1015` and a `dropped` row
  have golden cases there too.

**Version profiles (#83, [ADR-0006](../adr/0006-version-ranges.md)).**

- `targets.<t>.version` (config schema: `major.minor.patch` only).
  `packages/core/src/profiles.js` picks the last manifest range covering it with
  #190's matcher (`semver.js`); `ctx.targetVersion` and `ctx.targetProfile` reach
  `emit`; `report.json` gets `version: { requested, profile }` only when a
  version was asked, so no example output moves. `TST1313` for a version outside
  every range, or asked of an exporter with none.
- shadcn's manifest: `["tailwind-v3", "tailwind-v4"]` → `[">=3 <4", ">=4 <5"]`
  (Tailwind versions); its era comes from `options.era`, else the profile, else
  `tailwind-v4`. Both set and disagreeing: the era wins, `TST2105` warns.
- plugin-kit: `manifest-targets-ranges` fails a `targets` entry core can't match
  (an era name, a prerelease); `ctx` in the kit carries `targetVersion: null`,
  `targetProfile: null`.
- `check:cli`: shadcn `3.4.17` is byte-identical to `era: "tailwind-v3"`,
  `4.1.13` to the default; Bootstrap `5.3.8` equals no version and records
  `>=5.3 <6`; `4.6.2` and `6.0.0` fail with `TST1313`.

**Found on the way.** The reference mapping did not reproduce css-variables: its
`color-scheme` block (every colour-bearing row) wrote eight
`--palette-categorical-*` lines css-variables' dark block did not. css-variables
chose its dark lines by path (`semantic.color.*`, plus shadows and borders), so
the categorical palette's dark values were lost while the report said `native`.
Fixed by choosing them by type; every example's css-variables stylesheet gains
its eight dark palette lines.

## Deviations from the issues and their refinements

- **Runtime in core, not a new `@transtyle/exporter-declarative` package**
  (refinement of #82). A new published package would need its own trusted
  publisher on npm before the next release, and core is where a mapping path is
  read; the runtime has no dependency either way.
- **The range syntax is #190's**, not the subset the #83 refinement proposed:
  `semver.js` landed with `^`, `~`, `||` and hyphen ranges, so manifests may use
  them. Prerelease tags stay out (they don't parse), which keeps `<6` from
  taking Bootstrap 6 alphas.
- **No `ctx.versionAtLeast()`**: no exporter needs a check finer than a profile yet.
- **Out of scope, split as follow-ups:** `transtyle add <npm package>` (the
  refinement's question 1: install, print the manifest, say "no code will run"),
  the Bootstrap `>=5.2 <5.3` profile (a second surface inventory and a demo
  pinned to 5.2.3), and `--force-profile`. Recording the resolved version in
  `transtyle.lock` stays with #1.
- **`TST1307` and `TST1311` were taken** (Style Dictionary v3 files, #146;
  malformed token metadata, #188) by the time this landed, so the version
  code is `TST1313`.
