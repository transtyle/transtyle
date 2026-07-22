# GOV.UK demo projects — the theme on real frameworks

Seven npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Acme/Cathode/Carbon's except `src/ds.config.*` and the package name/port — same code, GOV.UK's real colors.

Run from the **repo root** (after `npm install`):

| Project                          | Command                                   | Port | What you get                                                                                                                    |
| -------------------------------- | ----------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| [bootstrap/](bootstrap/)         | `npm run dev -w govuk-demo-bootstrap`     | 4301 | _Nimbus Console_ in real Bootstrap 5.3, **Sass path** — `.btn-primary` & friends compiled from the GOV.UK theme                 |
| [daisyui/](daisyui/)             | `npm run dev -w govuk-demo-daisyui`       | 4302 | The same page in daisyUI 5                                                                                                      |
| [shadcn/](shadcn/)               | `npm run dev -w govuk-demo-shadcn`        | 4303 | The same page in real shadcn/ui registry components (React + Radix + Tailwind v4)                                               |
| [echarts/](echarts/)             | `npm run dev -w govuk-demo-echarts`       | 4304 | _Nimbus Analytics_ — a chart dashboard shelled in GOV.UK's blue                                                                 |
| [storybook/](storybook/)         | `npm run dev -w govuk-demo-storybook`     | 6301 | Storybook's **own chrome** wearing the theme; stories are one explanatory text page                                             |
| [css-variables/](css-variables/) | `npm run dev -w govuk-demo-css-variables` | 4305 | Every catalog slot as a plain `--custom-property`, browsed by family                                                            |
| [radix/](radix/)                 | `npm run dev -w govuk-demo-radix`         | 4306 | The same page in real `@radix-ui/themes` components — the compiled `primary`/`neutral` scales override the `blue`/`gray` preset |

Every page has a mode toggle wired to the target's own mechanism — except GOV.UK only declares `light` mode (its public design system has no published dark theme), so the toggle has nothing to switch to; this is the intended behavior, not a bug. Fonts render in `arial` (GOV.UK's own documented fallback): the real GDS Transport typeface is licensed to crown services only.
