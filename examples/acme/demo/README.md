# Acme demo projects — the theme on real frameworks

Five npm projects, one per target, each themed **only** by the artifacts `transtyle build` writes to [`../dist/`](../dist/) (a `predev` hook rebuilds them). Spec: [docs/specs/demo-app.md](../../../docs/specs/demo-app.md). Within each target, these projects are file-identical to Cathode's except `src/ds.config.*` and the package name/port.

Run from the **repo root** (after `npm install`):

| Project | Command | Port | What you get |
|---|---|---|---|
| [bootstrap/](bootstrap/) | `npm run dev -w acme-demo-bootstrap` | 4101 | *Nimbus Console* in real Bootstrap 5.3, **Sass path** — `.btn-primary` & friends compiled from the theme |
| [daisyui/](daisyui/) | `npm run dev -w acme-demo-daisyui` | 4102 | The same page in daisyUI 5 — the generated `@plugin` blocks register both mode themes natively |
| [shadcn/](shadcn/) | `npm run dev -w acme-demo-shadcn` | 4103 | The same page in real shadcn/ui registry components (React + Radix + Tailwind v4) |
| [echarts/](echarts/) | `npm run dev -w acme-demo-echarts` | 4104 | *Nimbus Analytics* — a chart dashboard; page shell colors come from the theme JSON itself |
| [storybook/](storybook/) | `npm run dev -w acme-demo-storybook` | 6101 | The simplest Storybook wearing the theme: themed chrome, Scheme toolbar, component + token stories |

Every page has a mode toggle wired to the target's own mechanism. Differences in *structure* between projects are framework idiom; **color, radius, and typography** must track the token source everywhere — a disagreement is a bug worth filing.
