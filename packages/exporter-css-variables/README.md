<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-css-variables

Plain CSS custom properties backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `variables.transtyle.css`: the resolved semantic catalog, 1:1, as CSS custom
properties. No framework, no opinions — useful on its own for a hand-rolled design system,
and the right target when no exporter exists for your stack yet.

It is also the **reference implementation of the plugin API**. An exporter is exactly this
and nothing more: `emit(normalized, ctx) → { files, coverage }`. If you are writing one,
read this package first — it is deliberately boring so that it stays readable.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-css-variables
npx transtyle add css-variables      # adds the target to transtyle.config.json
npx transtyle build css-variables
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [css-variables exporter guide](https://transtyle.github.io/transtyle/docs/exporter-css-variables/)
- [Write an exporter](https://transtyle.github.io/transtyle/docs/write-an-exporter/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
