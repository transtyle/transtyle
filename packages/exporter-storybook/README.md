<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-storybook

Storybook backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `theme.transtyle.ts`, `manager.transtyle.ts` and `preview.transtyle.ts` for
Storybook 8–9.

The meta-target. Most of a design system is inexpressible in Storybook's chrome theming, so
it flows through **preview composition** instead: `options.previewTargets` names sibling
targets by instance name, and the build manifest supplies their artifact locations — never
their resolutions, because targets must not couple to each other's output.

Colours are emitted as hex: Storybook's theming pipeline does not parse `oklch()`.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-storybook
npx transtyle add storybook      # adds the target to transtyle.config.json
npx transtyle build storybook
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Storybook exporter guide](https://transtyle.github.io/transtyle/docs/exporter-storybook/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
