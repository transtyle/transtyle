<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-chakra

Chakra UI backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `theme.transtyle.ts` for Chakra UI v3: a `defineConfig()` object, and the
`createSystem(defaultConfig, config)` call to pass to `<ChakraProvider value={system}>`.

Every role becomes a Chakra colour palette with its eight semantic keys (`solid`,
`contrast`, `fg`, `subtle`, `muted`, `emphasized`, `border`, `focusRing`), each with a light
and a dark value, so `colorPalette="danger"` follows the design system in both schemes.
Chakra's default palette and its Alert statuses are pointed at the roles of the same
meaning (`neutral`, `info`, `warning`, `success`, `danger`); its own hue palettes stay
untouched. The config holds overrides and additions only: whatever the design system has
no meaning for stays Chakra's.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-chakra
npx transtyle add chakra       # adds the target to transtyle.config.json
npx transtyle build chakra
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Chakra UI exporter guide](https://transtyle.github.io/transtyle/docs/exporter-chakra/)
- [The role grid](https://transtyle.github.io/transtyle/docs/language/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
