<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-echarts

Apache ECharts backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `theme.<name>.json` and `theme.<name>.js` — theme objects that register straight into
ECharts.

ECharts has no runtime mode concept: theme choice happens at init. So the colour-scheme
dimension becomes **one theme file per mode**, which is the native pattern for this
ecosystem rather than a workaround. Colours are hex because the canvas renderer needs them
to be; where OKLCH → hex gamut-clamps, the value is reported as `approximated` rather than
presented as exact.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-echarts
npx transtyle add echarts      # adds the target to transtyle.config.json
npx transtyle build echarts
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [ECharts exporter guide](https://transtyle.github.io/transtyle/docs/exporter-echarts/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
