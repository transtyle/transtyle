<p align="center">
  <a href="https://transtyle.github.io/transtyle/"><img src="https://raw.githubusercontent.com/transtyle/transtyle/main/brand/transtyle-mark-on-dark-256.png" alt="Transtyle" width="88" height="88"></a>
</p>

# @transtyle/cli

The command line for **[Transtyle](https://transtyle.github.io/transtyle/)**, a design system compiler.

"Our brand color is `#4f46e5`" is one decision. In a real product it lives in a Bootstrap Sass variable, a `--primary` in shadcn's `globals.css`, a JSON key in an ECharts theme, and a knob in Storybook's manager — maintained four times, by hand. Transtyle makes it one input: describe your design system once as W3C (DTCG) design tokens, and compile native, idiomatic theme artifacts for every ecosystem you ship in. Nothing you ship depends on Transtyle at runtime.

> [!WARNING]
> **Alpha — experimental.** Breaking changes ship without a deprecation cycle: the token
> vocabulary, the generated output, the config format and the CLI surface can each change
> between alpha releases. Pin an exact version, and treat generated files as disposable
> output you regenerate — never as something to hand-edit and keep.
> ([why](https://github.com/transtyle/transtyle/blob/main/docs/adr/0010-pre-release-breaking-changes.md))

## Use

```bash
npm i -D @transtyle/cli
npx transtyle init               # scaffold transtyle.config.json + starter tokens
npx transtyle add bootstrap      # add a target
npx transtyle build              # compile every configured target
```

## Commands

| Command                                  | Does                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`                                   | Ask for a brand color, schemes, targets, preset and layout, then scaffold the files                                                                                 |
| `add <target>`                           | Add one of the nine official targets to the config                                                                                                                  |
| `build [target…]`                        | Compile — writes artifacts, `usage.md`, `report.json` and `transtyle-manifest.json` (hashes for drift detection)                                                    |
| `check`                                  | The whole pipeline without emitting: validation, contrast, coverage, generated files edited by hand                                                                 |
| `check --matrix`                         | Which targets read each catalog slot, so you know what authoring one changes                                                                                        |
| `explain <slot>`                         | Why one token has the value it has, rule by rule, with provenance                                                                                                   |
| `explain --variable <name> --target <t>` | From a target variable (`$btn-border-radius`) back to the slot it reads, then why it has that value; `explain <slot> --target <t>` lists the variables a slot feeds |
| `diff [ref]`                             | Semantic diff of the resolved graph against a git ref, including contrast regressions                                                                               |
| `catalog`                                | Every catalog slot with its type and derivation rule; `--json` for tools                                                                                            |
| `bind --suggest`                         | Draft bindings from your own token names and colors, each with its reason                                                                                           |

`build` and `check` exit non-zero on error; `diff` uses `git diff`-style exit codes. Every
command takes `--json` where a machine might be reading, and diagnostics carry stable
`TST`-prefixed codes — the CLI is meant to be driven by agents as well as people.

`--cwd <dir>` runs against another directory and `--config <file>` picks another config file
there. A config can `extends` a shared base, so several products or design systems live in one
repository without copying it ([configuration](https://transtyle.github.io/transtyle/docs/configuration/#extends--several-products-one-design-system)).

## Targets

`shadcn`, `daisyui`, `bootstrap`, `echarts`, `storybook`, `css-variables`, `radix`, `primeng`.
Third-party exporters work the same way: name the package in `targets` and it is loaded
from your project.

## Documentation

- [CLI reference](https://transtyle.github.io/transtyle/docs/cli/)
- [Getting started](https://transtyle.github.io/transtyle/docs/getting-started/)
- [Diagnostics](https://transtyle.github.io/transtyle/docs/diagnostics/)

## License

MIT — part of the [Transtyle](https://github.com/transtyle/transtyle) monorepo.
