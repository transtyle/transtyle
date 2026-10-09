# Exporters are checked against the core they run on

Issue [#14](https://github.com/transtyle/transtyle/issues/14). versioning.md
promised that core checks each exporter's declared `irSpec` and `pluginApi` at
load time, and ADR-0011 §2 named "range-checking unimplemented" as a blocker on
freezing the plugin API. Nothing read the manifests: `plugin-kit` checked the
two fields were present, any value passed, and an exporter built for another
core failed in whatever way its own code happened to.

## What changed

- `packages/core/src/semver.js`: a zero-dependency semver range check
  (node-semver's meaning for partial and x-ranges, `^`, `~`, comparators,
  hyphen ranges and `||`; no prerelease tags). Nothing parsed ranges before;
  #83 (target framework ranges) can reuse it.
- `packages/core/src/compat.js`: `checkPluginCompat(manifest)` and
  `PLUGIN_API_VERSIONS = ['0.0.0']`. `pluginApi` must be a range accepting one
  of those versions; `irSpec` must equal `IR_SPEC` (`v0-draft`), because a
  marker without a version number can only match exactly. A value that is a
  range against a provided value that is a version is a range check; anything
  else is an exact match, so `irSpec` becomes a range check by itself the day
  the IR spec carries a version.
- `compile()` checks right after `loadExporter`, before the options schema:
  `TST1309` (error) per mismatched field, `TST1310` (warning) when the manifest
  or a field is missing. Like `TST3002`, an incompatible exporter is recorded
  per target: later targets are still loaded and checked, so one run lists
  every incompatible exporter, and the atomic commit writes nothing.
- Loader contract, backward compatible: `loadExporter` may return
  `{ plugin, manifest, package }`; a bare plugin is not checked. The CLI's
  loader walks up from the resolved entry file to the `package.json` named
  after the requested package (exporters export only `"."`, so
  `<pkg>/package.json` can't be resolved), and uses `import.meta.resolve` for
  its own install so it has a file to walk up from. The recording loader behind
  `check --matrix` and `explain --target` keeps the shape.
- `plugin-kit`: `manifest-compatible`, the same function, run with
  `{ manifest }`.

## What was measured

- All eleven official exporters (MUI included) declare `"irSpec": "v0-draft"`, `"pluginApi": "0"`
  and pass `manifest-compatible`; setting one to `"9"` makes
  `transtyle build` report `TST1309` for it.
- `check:cli`: a fake third-party exporter in a temporary project's
  `node_modules` with `irSpec: "v1"`, `pluginApi: "^1"`, both, a range that
  accepts this core (`>=0 <2`), and no manifest.
- `check:plugins`: 16 range cases, 3 marker cases, and two negative manifests.
- Every example builds byte-identical (`check:fixtures`, `check:determinism`).

## Deviations

- The issue proposed semver ranges for both fields. `irSpec` keeps the
  `v0-draft` marker the manifests already hold, matched exactly: a range needs a
  numeric IR spec version, which arrives with the freeze. `pluginApi` keeps its
  `"0"`, which is already a valid range (any `0.x`).
- Codes: `TST1309`/`TST1310`, the next free ones (`TST1307` and `TST1308` were
  taken while the issue waited).
- The plugin API version core implements is `0.0.0`, the pre-freeze line; there
  is no plugin API changelog to give it a minor yet.
