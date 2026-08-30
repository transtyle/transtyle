<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-primeng

PrimeNG backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `preset.transtyle.ts` — a `definePreset(Aura, overrides)` TypeScript module.

The strategy is to **override Aura rather than author a preset from zero**: anything not
emitted is filled by Aura's own default at runtime, so the output stays small and survives
PrimeNG's own updates. Every emitted preset is type-checked against PrimeNG's `DesignTokens`
types as part of `ng build` in this repo's demos, which has caught real structural bugs.

**Component tier:** a full `variant × severity × state` colour grid for Button; flat
`severity × part` for Tag, Badge, Message and InlineMessage; primary-anchored only for
ProgressBar and Rating — because PrimeNG genuinely has no severity axis there, verified
against its source rather than assumed.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-primeng
npx transtyle add primeng      # adds the target to transtyle.config.json
npx transtyle build primeng
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [PrimeNG exporter guide](https://transtyle.github.io/transtyle/docs/exporter-primeng/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
