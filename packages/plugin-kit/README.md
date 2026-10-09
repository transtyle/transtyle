<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/plugin-kit

The executable specification of the **[Transtyle](https://transtyle.github.io/transtyle/)** exporter interface.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

An exporter is one function: `emit(normalized, ctx) → { files, coverage, diagnostics? }`. This package is
the conformance suite that proves yours honors the contract — the same suite every official
exporter runs against in CI.

## Use

```js
import { conformance } from '@transtyle/plugin-kit';
import plugin from './src/index.js';

const { pass, checks } = await conformance(plugin);
if (!pass) {
  console.error(checks.filter((c) => !c.pass));
  process.exit(1);
}
```

It runs your plugin against every fixture design system below and checks shape,
determinism, IR immutability, honest coverage, well-formed diagnostics (when the plugin
returns any), and manifest and options-schema validity —
each failure naming the fixture and citing the line of the spec it enforces. Pass
`{ fixtures: 'canonical' }` to run the original single fixture only, or an array of
fixture names. `fixtureIR(name)` hands you a fixture's IR if you want to write your own
assertions on top, and `FIXTURES` lists them.

It has caught real bugs in official exporters on first run, which is the only reason to
trust it.

## Fixtures

Each is a plain DTCG project under [`fixtures/`](https://github.com/transtyle/transtyle/tree/main/packages/plugin-kit/fixtures), compiled by the real
loader: open one to see exactly what your plugin received.

| Fixture          | What it exercises                                                                                                          | Spec it enforces                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `canonical`      | a brand color, light and dark, elevation, text, border, fonts; radius, a duration and an easing in DTCG structured form    | [plugins.md, the exporter interface][iface]                                                    |
| `one-token`      | only `semantic.color.primary.solid`; everything else is derived or absent                                                  | [validation-and-coverage.md, coverage report][cov]: a missing slot is a row, not a crash       |
| `three-token`    | brand, page background and text, with dark values; no radius, spacing or fonts                                             | [validation-and-coverage.md, coverage report][cov]: absence is not coverage                    |
| `two-dimension`  | `color-scheme` × `density`, with `space.4` authored differently under `density: compact`                                   | [ir.md, modes][modes] and [coverage report][cov]: a mode the target can't express is `dropped` |
| `single-mode`    | `color-scheme` with `light` only: there is no `dark` map                                                                   | [ir.md, modes][modes]                                                                          |
| `component-tier` | authored `component.control.radius`, `button.radius` (an alias to a derived slot), `button.padding-x`, `tooltip.max-width` | [ir.md, the three-tier token model][tiers]                                                     |
| `custom-role`    | a custom `promo` role joining the grid through `$extensions.transtyle.role`                                                | [ir.md, the role grid][grid]                                                                   |
| `composites`     | authored shadow (per mode, stacked with `inset`, aliased), border, transition and typography                               | [ir.md, values and canonicalization][values]                                                   |
| `object-form`    | colors and dimension, duration, cubicBezier, fontWeight, typography members in DTCG structured form, two dimensions        | [ir.md, values and canonicalization][values]: byte-identical to the string form                |

## Checks

Once per plugin: `interface-shape`, `manifest-valid` and `manifest-compatible` (with
`{ manifest }`: the fields are there, and `irSpec`/`pluginApi` accept this `@transtyle/core`,
the check the CLI runs at load time), `options-schema-shape` (when the plugin has an `optionsSchema`). Then on every fixture:

| Check                          | Asserts                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `emit-runs`                    | `emit` completes                                                                                       |
| `emit-returns-files`           | `files` are `{ path, contents, kind }`                                                                 |
| `emit-returns-coverage`        | `coverage` items are `{ variable, slot, class }`                                                       |
| `coverage-classes-valid`       | every class is one of the five                                                                         |
| `emit-diagnostics-valid`       | `diagnostics`, if returned, are `{ severity: info\|warning, code, message, hint? }`                    |
| `deterministic`                | two `emit` runs produce byte-identical files and diagnostics                                           |
| `ir-immutable`                 | `emit` did not mutate the IR                                                                           |
| `files-non-empty`              | every file has content                                                                                 |
| `no-leaked-values`             | no line carries `undefined`, `null` or `NaN` as a value, or `NaN` / `[object Object]` anywhere         |
| `coverage-honest`              | no `native` or `derived` row names a slot that does not resolve                                        |
| `mode-dimensions-accounted`    | `two-dimension` only: the compact `density` value is in a file, or a `(mode:density)` row is `dropped` |
| `structured-values-as-strings` | `object-form` only: the files are byte-identical to the same design system authored with CSS strings   |

[iface]: https://github.com/transtyle/transtyle/blob/main/docs/architecture/plugins.md#the-exporter-interface
[cov]: https://github.com/transtyle/transtyle/blob/main/docs/specs/validation-and-coverage.md#coverage-report
[modes]: https://github.com/transtyle/transtyle/blob/main/docs/architecture/ir.md#modes
[tiers]: https://github.com/transtyle/transtyle/blob/main/docs/architecture/ir.md#the-three-tier-token-model
[grid]: https://github.com/transtyle/transtyle/blob/main/docs/architecture/ir.md#color-the-role-grid
[values]: https://github.com/transtyle/transtyle/blob/main/docs/architecture/ir.md#values-and-canonicalization

## Documentation

- [Write an exporter](https://transtyle.github.io/transtyle/docs/write-an-exporter/)
- [Internals — the plugin contract](https://transtyle.github.io/transtyle/docs/internals/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
