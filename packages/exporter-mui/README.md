<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-mui

Material UI backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Emits `theme.transtyle.ts` for Material UI v9: a `ThemeOptions` object in CSS-variables
mode (`themeOptions`), and the `createTheme()` call to pass to `<ThemeProvider theme={theme}>`.

Every role becomes a palette key in each colour scheme (`danger` is MUI's `error`; `accent`,
`neutral` and custom roles are extra keys the module declares for TypeScript), so
`<Button color="primary">` follows the design system in light and dark. Text and outlined
buttons wear the role's text and outline cells, the Alert severities read their roles, Paper
overlays lift each elevation onto the design system's own surfaces, and the design system's
focus ring turns on MUI's keyboard focus ring. Every value is data: no function in the theme.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-mui
npx transtyle add mui          # adds the target to transtyle.config.json
npx transtyle build mui
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Material UI exporter guide](https://transtyle.github.io/transtyle/docs/exporter-mui/)
- [The role grid](https://transtyle.github.io/transtyle/docs/language/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
