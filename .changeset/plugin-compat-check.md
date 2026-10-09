---
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/plugin-kit': minor
---

Refuse an exporter built for another IR spec or plugin API, with a diagnostic that says which and what to install, instead of letting it fail in whatever way its code happens to.

The CLI now reads each exporter's `transtyle` manifest from its `package.json` and core checks it before running the exporter: `pluginApi` is a semver range that must accept the plugin API version core implements (`0.0.0`, so `"0"` or `"^0"`), and `irSpec` must be `"v0-draft"`. A mismatch is a `TST1309` error naming the target, the package, its version, what it declares and what core provides; every target is checked in the same run and nothing is written. An exporter package without a manifest still loads, with a `TST1310` warning. All official exporters already declare matching values.

`@transtyle/core` exports `checkPluginCompat(manifest)` and `PLUGIN_API_VERSIONS`; a custom `loadExporter` passed to `compile()` opts into the check by returning `{ plugin, manifest, package: { name, version } }` (returning the plugin itself still works, unchecked). `@transtyle/plugin-kit` adds a `manifest-compatible` conformance check, run when `{ manifest }` is given, so a wrong value fails an exporter's own CI first.
