# Cathode demo projects — the hostile DS on real frameworks

Seven npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Acme's except `src/ds.config.*` and the package name/port — same code, radically different rendering: that's the proof.

All projects boot **terminal-dark** (Cathode's native mode; light is the paper printout). Run from the **repo root** (after `npm install`):

| Project                          | Command                                     | Port | What you get                                                                                                                                                               |
| -------------------------------- | ------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [bootstrap/](bootstrap/)         | `npm run dev -w cathode-demo-bootstrap`     | 4201 | A phosphor-green _Nimbus Console_ in real Bootstrap 5.3 (Sass path)                                                                                                        |
| [daisyui/](daisyui/)             | `npm run dev -w cathode-demo-daisyui`       | 4202 | The same page in daisyUI 5, CRT-themed                                                                                                                                     |
| [shadcn/](shadcn/)               | `npm run dev -w cathode-demo-shadcn`        | 4203 | The same page in real shadcn/ui components — zero radius, IBM Plex Mono, glowing green                                                                                     |
| [echarts/](echarts/)             | `npm run dev -w cathode-demo-echarts`       | 4204 | _Nimbus Analytics_ with the green-anchored derived palette ("a dashboard from 1983")                                                                                       |
| [storybook/](storybook/)         | `npm run dev -w cathode-demo-storybook`     | 6201 | A Storybook whose **own chrome** boots terminal-dark (DS-native mode) — sidebar, toolbar, and Controls panel in phosphor green; stories are just one explanatory text page |
| [css-variables/](css-variables/) | `npm run dev -w cathode-demo-css-variables` | 4205 | Every catalog slot as a plain `--custom-property`, boots terminal-dark, browsed by family                                                                                  |
| [radix/](radix/)                 | `npm run dev -w cathode-demo-radix`         | 4206 | The same page in real `@radix-ui/themes` components — the compiled `primary`/`neutral` scales override an existing Radix preset (`green`/`gray`), boots terminal-dark      |
