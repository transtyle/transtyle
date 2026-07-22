# Carbon demo projects — the theme on real frameworks

Seven npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Acme/Cathode/GOV.UK's except `src/ds.config.*` and the package name/port — same code, Carbon's real colors and real IBM Plex fonts.

Run from the **repo root** (after `npm install`):

| Project                          | Command                                    | Port | What you get                                                                                                                      |
| -------------------------------- | ------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| [bootstrap/](bootstrap/)         | `npm run dev -w carbon-demo-bootstrap`     | 4401 | _Nimbus Console_ in real Bootstrap 5.3, **Sass path** — `.btn-primary` & friends compiled from the Carbon theme                   |
| [daisyui/](daisyui/)             | `npm run dev -w carbon-demo-daisyui`       | 4402 | The same page in daisyUI 5 — both White and G100 theme blocks register natively                                                   |
| [shadcn/](shadcn/)               | `npm run dev -w carbon-demo-shadcn`        | 4403 | The same page in real shadcn/ui registry components (React + Radix + Tailwind v4)                                                 |
| [echarts/](echarts/)             | `npm run dev -w carbon-demo-echarts`       | 4404 | _Nimbus Analytics_ — a chart dashboard, Blue 60-anchored                                                                          |
| [storybook/](storybook/)         | `npm run dev -w carbon-demo-storybook`     | 6401 | Storybook's **own chrome** wearing the theme; stories are one explanatory text page                                               |
| [css-variables/](css-variables/) | `npm run dev -w carbon-demo-css-variables` | 4405 | Every catalog slot as a plain `--custom-property`, browsed by family                                                              |
| [radix/](radix/)                 | `npm run dev -w carbon-demo-radix`         | 4406 | The same page in real `@radix-ui/themes` components — the compiled `primary`/`neutral` scales override the `indigo`/`gray` preset |

Every page has a real light/dark mode toggle — Carbon's actual White and G100 core token values, not a synthetic derived dark mode. IBM Plex Sans/Mono load for real (open-source, unlike GOV.UK's licensed Transport typeface).
