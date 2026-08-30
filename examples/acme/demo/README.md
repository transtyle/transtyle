# Acme demo projects — the theme on real frameworks

> **Deployed:** every project below is also running at
> <https://transtyle.github.io/transtyle/demo/> — rebuilt from these sources on each
> deploy, with a corner switcher for hopping between design systems and targets.

Eight npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Cathode's except `src/ds.config.*` and the package name/port.

Run from the **repo root** (after `npm install`):

| Project                          | Command                                  | Port | What you get                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [bootstrap/](bootstrap/)         | `npm run dev -w acme-demo-bootstrap`     | 4101 | _Nimbus Console_ in real Bootstrap 5.3, **Sass path** — `.btn-primary` & friends compiled from the theme                                                                                              |
| [daisyui/](daisyui/)             | `npm run dev -w acme-demo-daisyui`       | 4102 | The same page in daisyUI 5 — the generated `@plugin` blocks register both mode themes natively                                                                                                        |
| [shadcn/](shadcn/)               | `npm run dev -w acme-demo-shadcn`        | 4103 | The same page in real shadcn/ui registry components (React + Radix + Tailwind v4)                                                                                                                     |
| [echarts/](echarts/)             | `npm run dev -w acme-demo-echarts`       | 4104 | _Nimbus Analytics_ — a chart dashboard; page shell colors come from the theme JSON itself                                                                                                             |
| [storybook/](storybook/)         | `npm run dev -w acme-demo-storybook`     | 6101 | The simplest Storybook — the exhibit is Storybook's **own chrome** (sidebar, toolbar, Controls panel, fonts) wearing the theme; stories are just one explanatory text page                            |
| [css-variables/](css-variables/) | `npm run dev -w acme-demo-css-variables` | 4105 | The plugin-API reference exporter — every catalog slot as a plain `--custom-property`, browsed by family, no framework in between                                                                     |
| [radix/](radix/)                 | `npm run dev -w acme-demo-radix`         | 4106 | The same page in real `@radix-ui/themes` components — the compiled `primary`/`neutral` scales override an existing Radix preset (`violet`/`gray`) so `<Theme accentColor="violet">` renders the brand |
| [primeng/](primeng/)             | `npm run dev -w acme-demo-primeng`       | 4107 | The same page in real PrimeNG components on Angular — the emitted preset is type-checked against PrimeNG's own `DesignTokens` types as part of `ng build`                                             |

Every page has a mode toggle wired to the target's own mechanism. Differences in _structure_ between projects are framework idiom; **color, radius, and typography** must track the token source everywhere — a disagreement is a bug worth filing.
