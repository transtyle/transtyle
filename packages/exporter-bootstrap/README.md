<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/exporter-bootstrap

Bootstrap backend for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

Bootstrap 5.3+ (`>=5.3 <6`), both consumption paths, because the community is split:

| File                        | Path                                         | Fidelity        |
| --------------------------- | -------------------------------------------- | --------------- |
| `_variables.transtyle.scss` | imported **before** Bootstrap                | full            |
| `_maps.transtyle.scss`      | imported **after** Bootstrap's own variables | full            |
| `bootstrap-theme.css`       | loaded after `bootstrap.css`                 | token tier only |

On the Sass path the OKLCH-derived subtle/emphasis values **replace** Bootstrap's own sRGB
tint/shade derivations. The CSS-variable path cannot reach values Sass baked into component
rules (`.btn-primary` backgrounds, hovers); that limit is documented rather than papered
over, and `report.json` says so per variable.

<!-- measured: bootstrap.surface.component = 657 -->

**Component tier:** all 657 component-scoped Bootstrap variables are classified against a
checked-in surface inventory that CI re-derives from Bootstrap's real `_variables.scss`.
Each is driven by a `component.*` token, chained through Bootstrap's own expressions,
follows a global, or is honestly reported as unsupported — never silently dropped.

## Use

```bash
npm i -D @transtyle/cli @transtyle/exporter-bootstrap
npx transtyle add bootstrap      # adds the target to transtyle.config.json
npx transtyle build bootstrap
```

The CLI resolves exporters **from your project first**, so this package does not have to be
a dependency of the CLI itself. Every build writes a `usage.md` next to the artifacts
explaining how to wire them into that ecosystem, and a `report.json` recording where every
value came from and what the target could not express.

## Documentation

- [Bootstrap exporter guide](https://transtyle.github.io/transtyle/docs/exporter-bootstrap/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
