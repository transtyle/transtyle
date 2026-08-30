# @transtyle/plugin-kit

The executable specification of the **[Transtyle](https://transtyle.github.io/transtyle/)** exporter interface.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

An exporter is one function: `emit(normalized, ctx) → { files, coverage }`. This package is
the conformance suite that proves yours honors the contract — the same suite every official
exporter runs against in CI.

## Use

```js
import { conformance } from '@transtyle/plugin-kit';
import plugin from './src/index.js';

const { passed, failures } = await conformance(plugin);
if (!passed) {
  console.error(failures);
  process.exit(1);
}
```

It runs a canonical fixture through your plugin and checks shape, determinism, IR
immutability, honest coverage classification, and manifest and options-schema validity —
each failure citing the line of the spec it enforces. `fixtureIR` hands you the same
fixture if you want to write your own assertions on top.

It has caught real bugs in official exporters on first run, which is the only reason to
trust it.

## Documentation

- [Write an exporter](https://transtyle.github.io/transtyle/docs/write-an-exporter/)
- [Internals — the plugin contract](https://transtyle.github.io/transtyle/docs/internals/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
