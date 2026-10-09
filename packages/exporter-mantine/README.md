<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-mantine

Mantine backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `theme.transtyle.ts` for Mantine 9: a `createTheme()` object and a `cssVariablesResolver`
to pass to `<MantineProvider>`.

Every role becomes a `virtualColor()` over two 10-step tuples, one per colour scheme, so one
name (`color="danger"`) follows the design system's light and dark grids. Mantine's
components read per-colour variant variables rather than tuple indices, and the resolver sets
each of them per scheme straight from the grid, so filled, light, outline and subtle variants
all show the compiled colours. There is no `--mantine-*` override stylesheet on purpose:
Mantine writes its variables at runtime, after any stylesheet, and only the resolver wins
that cascade.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-mantine
npx transtyle add mantine      # adds the target to transtyle.config.json
npx transtyle build mantine
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Mantine exporter guide](https://transtyle.github.io/transtyle/docs/exporter-mantine/)
- [The role grid](https://transtyle.github.io/transtyle/docs/language/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
