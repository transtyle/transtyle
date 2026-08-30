/**
 * The demo harness, as data — one description of the 32 demo projects that the
 * builder, the assembler, the website gallery and the guards all read.
 *
 * There are two halves here, and the split is deliberate:
 *
 *   `discoverDemos()` reads the filesystem. Which demos exist, what toolchain
 *   each one uses and which port it serves on are facts about the repo, so
 *   they are *found*, never listed. A ninth target or a fifth example is then
 *   picked up by the builder, the CI matrix check and the gallery page on the
 *   commit that adds it, with no list anywhere to forget.
 *
 *   `EXAMPLES` / `TARGETS` carry what the filesystem cannot say: display
 *   names, the one line that tells a visitor what they are looking at, and
 *   which docs page explains it. Prose has to be written by a person. What is
 *   guarded (scripts/check-demos.mjs) is that these two halves agree — every
 *   discovered example and target has an entry, and every entry exists on
 *   disk.
 *
 * Shared by: scripts/build-demos.mjs, scripts/assemble-demos.mjs,
 * scripts/check-demos.mjs, website/src/pages/demo/index.astro.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The four design systems, in the order the gallery and the docs present them:
 * invented-minimal, invented-hostile, then the two real published systems.
 * That order is an argument — it walks from "this is what the compiler needs"
 * to "this is a system nobody here designed" — so it is fixed, not alphabetical.
 */
export const EXAMPLES = [
  {
    id: 'acme',
    title: 'Acme',
    kicker: 'Invented · minimal',
    blurb:
      'The smallest believable design system: one brand blue, a few neutrals, one radius. Everything else in the output is derived.',
    look: 'Blue, rounded, conventional — the baseline every other column is a departure from.',
  },
  {
    id: 'cathode',
    title: 'Cathode',
    kicker: 'Invented · hostile',
    blurb:
      'A retro CRT terminal system built to attack every default: alien vocabulary, dark-native, brand colour that is also the text colour, radius 0.',
    look: 'Phosphor green on tube black, monospace, hard corners. Toggle to light for the paper-printout mode.',
  },
  {
    id: 'govuk',
    title: 'GOV.UK',
    kicker: 'Real · public sector',
    blurb:
      "The UK government's design system, adopted through the binding layer — its published colours and its own functional-colour names, untouched.",
    look: 'Flat, high-contrast, unmistakably GOV.UK. Light only: the real system publishes no dark theme.',
    unaffiliated: 'the UK Government Digital Service',
  },
  {
    id: 'carbon',
    title: 'Carbon',
    kicker: 'Real · enterprise',
    blurb:
      "IBM's Carbon Design System, bound the same way — with its real per-theme values, White → light and G100 → dark.",
    look: 'IBM Plex, square corners, Carbon blue. A real dark theme, carrying Carbon’s own G100 values.',
    unaffiliated: 'IBM',
  },
];

/**
 * The eight targets, ordered as the docs sidebar orders them (nav.js "Targets"):
 * the two most-asked-for first, then the rest, with the plain-CSS reference
 * exporter last because it is the one you read rather than look at.
 *
 * `doc` is the website slug; check-demos.mjs proves each one exists and is in
 * the sidebar, so a renamed docs page cannot leave the gallery pointing at a 404.
 */
export const TARGETS = [
  {
    id: 'shadcn',
    title: 'shadcn/ui',
    doc: 'exporter-shadcn',
    stack: 'React · Tailwind v4 · Radix',
    blurb: 'Real shadcn/ui registry components, themed by the generated globals.css.',
  },
  {
    id: 'daisyui',
    title: 'daisyUI',
    doc: 'exporter-daisyui',
    stack: 'Tailwind v4',
    blurb: 'Both modes registered natively as daisyUI themes via generated @plugin blocks.',
  },
  {
    id: 'echarts',
    title: 'Apache ECharts',
    doc: 'exporter-echarts',
    stack: 'ECharts 5',
    blurb: 'A chart dashboard — the data-viz palette derived from the same one brand colour.',
  },
  {
    id: 'bootstrap',
    title: 'Bootstrap',
    doc: 'exporter-bootstrap',
    stack: 'Bootstrap 5.3 · Sass',
    blurb: 'The Sass path: .btn-primary and friends compiled from the theme, not overridden.',
  },
  {
    id: 'storybook',
    title: 'Storybook',
    doc: 'exporter-storybook',
    stack: 'Storybook 9',
    blurb: "The exhibit is Storybook's own chrome — sidebar, toolbar and panels wearing the theme.",
  },
  {
    id: 'radix',
    title: 'Radix Themes',
    doc: 'exporter-radix',
    stack: 'React · @radix-ui/themes',
    blurb: 'Compiled 12-step scales overriding a stock Radix preset in place.',
  },
  {
    id: 'primeng',
    title: 'PrimeNG',
    doc: 'exporter-primeng',
    stack: 'Angular 22',
    blurb: "A typed PrimeNG preset — checked against PrimeNG's own DesignTokens types at build.",
  },
  {
    id: 'css-variables',
    title: 'CSS variables',
    doc: 'exporter-css-variables',
    stack: 'No framework',
    blurb: 'Every catalog slot as a plain custom property, browsable by family. The reference dump.',
  },
];

export const exampleById = (id) => EXAMPLES.find((e) => e.id === id);
export const targetById = (id) => TARGETS.find((t) => t.id === id);

/**
 * How a demo is built, inferred from what is in its directory.
 *
 * Each profile answers three questions: what command builds it, what argument
 * makes the output work from a *subdirectory* (see below), and where the files
 * land. Nothing here is configured per demo — the marker file decides, so the
 * ninth target inherits a profile by looking like one.
 *
 * The subpath argument is the whole reason this table exists. Hosted, a demo
 * lives at /transtyle/demo/<example>/<target>/, and a bundler that assumes the
 * server root emits /assets/index.js — a 404 that is invisible locally, since
 * every demo's own dev server *is* a root. Relative bases ('./') fix it without
 * naming the deploy path anywhere, so the same build works under the project
 * Pages base, under a future transtyle.dev root, and from a file:// URL.
 */
const PROFILES = {
  angular: {
    marker: 'angular.json',
    args: ['--base-href', './'],
    // @angular/build:application writes the browser bundle one level deeper
    // than every other builder; `<pkg>` is substituted with the workspace name.
    out: 'dist/<pkg>/browser',
  },
  storybook: {
    marker: '.storybook',
    // Storybook's static build already emits relative asset URLs, so it needs
    // no argument — verified against the emitted index.html, not assumed.
    args: [],
    out: 'storybook-static',
  },
  vite: {
    marker: null, // the fallback
    args: ['--base=./'],
    out: 'dist',
  },
};

/**
 * The repo root, found by walking up from the working directory.
 *
 * Deliberately not derived from `import.meta.url`. Astro bundles the site's
 * endpoints into website/dist/.prerender/chunks/ before running them, so a
 * module that locates the repo by counting '..' from its own URL is correct in
 * a .astro page and wrong in an endpoint — which is exactly how it failed:
 * llms.txt went looking for website/examples/. Walking up for a directory that
 * has both markers is true wherever the code is executed from.
 */
export function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, 'examples')) && existsSync(join(dir, 'package-lock.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error(`repoRoot: no repo root above ${from}`);
    dir = up;
  }
}

/** Every demo project in the repo, ordered as EXAMPLES × TARGETS. */
export function discoverDemos(root) {
  const found = [];
  const examplesDir = join(root, 'examples');
  for (const example of readdirSync(examplesDir)) {
    const demoDir = join(examplesDir, example, 'demo');
    if (!existsSync(demoDir)) continue;
    for (const target of readdirSync(demoDir)) {
      const dir = join(demoDir, target);
      const manifest = join(dir, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      const profile = existsSync(join(dir, PROFILES.angular.marker))
        ? 'angular'
        : existsSync(join(dir, PROFILES.storybook.marker))
          ? 'storybook'
          : 'vite';
      found.push({
        example,
        target,
        dir,
        workspace: pkg.name,
        profile,
        buildArgs: PROFILES[profile].args,
        outDir: join(dir, PROFILES[profile].out.replace('<pkg>', pkg.name)),
        // The local port, read from the dev script rather than repeated here:
        // the demo READMEs and the gallery both quote it, and a port that moved
        // in package.json used to leave two documents quietly wrong.
        port: Number(/(?:--port|-p)[= ](\d+)/.exec(pkg.scripts?.dev ?? '')?.[1]) || null,
      });
    }
  }
  const order = (list, key) => (d) => {
    const i = list.findIndex((x) => x.id === d[key]);
    return i === -1 ? list.length : i;
  };
  const byExample = order(EXAMPLES, 'example');
  const byTarget = order(TARGETS, 'target');
  return found.sort((a, b) => byExample(a) - byExample(b) || byTarget(a) - byTarget(b));
}

/** Where a demo is served from, relative to the site root. */
export const demoPath = (example, target) => `/demo/${example}/${target}/`;
