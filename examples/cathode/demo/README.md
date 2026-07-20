# Cathode demo projects — the hostile DS on real frameworks

Five npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Acme's except `src/ds.config.*` and the package name/port — same code, radically different rendering: that's the proof.

All projects boot **terminal-dark** (Cathode's native mode; light is the paper printout). Run from the **repo root** (after `npm install`):

| Project | Command | Port | What you get |
|---|---|---|---|
| [bootstrap/](bootstrap/) | `npm run dev -w cathode-demo-bootstrap` | 4201 | A phosphor-green *Nimbus Console* in real Bootstrap 5.3 (Sass path) |
| [daisyui/](daisyui/) | `npm run dev -w cathode-demo-daisyui` | 4202 | The same page in daisyUI 5, CRT-themed |
| [shadcn/](shadcn/) | `npm run dev -w cathode-demo-shadcn` | 4203 | The same page in real shadcn/ui components — zero radius, IBM Plex Mono, glowing green |
| [echarts/](echarts/) | `npm run dev -w cathode-demo-echarts` | 4204 | *Nimbus Analytics* with the green-anchored derived palette ("a dashboard from 1983") |
| [storybook/](storybook/) | `npm run dev -w cathode-demo-storybook` | 6201 | A Storybook whose chrome itself boots terminal-dark (DS-native mode) |
