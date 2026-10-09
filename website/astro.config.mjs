// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import deramond from '@deramond.dev/astro/integration';
import { baseUrlsPlugin } from './base-urls-plugin.mjs';
import { devDemosPlugin } from './dev-demos-plugin.mjs';

// Where the site actually lives.
//
// It is a GitHub Pages *project* site for github.com/transtyle/transtyle, so
// it is served from https://transtyle.github.io/transtyle/ — under a path, not
// at a domain root. `base` is therefore load-bearing rather than cosmetic:
// Astro prefixes the asset URLs it emits with it, `import.meta.env.BASE_URL`
// carries it to every hand-written link through src/url.js, and `site` is what
// makes canonical/OG/sitemap URLs point at a page that exists.
//
// These are the defaults, not an override, on purpose: CI's `npm run
// site:build` then builds exactly what ships, so there is no second
// configuration that only the deploy exercises. The env vars are for a preview
// build elsewhere. When transtyle.dev exists this is a two-line change —
// `site` to the domain, `base` to '/' — and nothing else in the site moves.
const site = process.env.SITE_URL ?? 'https://transtyle.github.io';
// The trailing slash is what Astro hands on as BASE_URL, so a link to the
// home page is /transtyle/ itself rather than a redirect hop away from it.
const base = process.env.SITE_BASE ?? '/transtyle/';

// Two blog posts that were published, indexed and carried in the feed before
// being merged into the post they now point at. A static build turns these
// into meta-refresh pages rather than HTTP 301s, which is the best a Pages
// project site can do — and better than the 404 an RSS reader would otherwise
// hit for a post it fetched yesterday. Delete them only when nothing anywhere
// still holds the old URL, which is not a date anyone can name.
//
// The destination carries `base` by hand and the sources do not, because Astro
// prefixes only one side: the redirect page lands at <base>/blog/<slug>/, but
// the URL it points at is emitted verbatim. Written as plain paths first, this
// shipped four links to /blog/… on a site served from /transtyle/ — caught by
// check-site-links.mjs, which is exactly the failure it was written for.
const merged = `${base.replace(/\/$/, '')}/blog/a-compiler-for-design-systems`;
const MERGED_POSTS = {
  '/blog/the-first-alpha': merged,
  '/blog/thirty-two-demos': merged,
};

// The version pill in the docs top bar follows the published CLI, which
// changesets bumps — the same number `npm install @transtyle/cli` gets.
const { version } = JSON.parse(readFileSync(new URL('../packages/cli/package.json', import.meta.url), 'utf8'));
const root = base.replace(/\/$/, '');

// The site's navigation, declared once: the header and the docs top bar both
// read it. The compare view belongs to Demos (Base.astro maps it), and "For AI
// agents" is a first-class way in.
const nav = [
  { label: 'Docs', href: `${root}/docs/` },
  { label: 'Demos', href: `${root}/demo/` },
  { label: 'Blog', href: `${root}/blog/` },
  { label: 'For AI agents', href: `${root}/docs/ai-agents/` },
];

export default defineConfig({
  site,
  base,
  redirects: MERGED_POSTS,
  // Astro 7 defaults to compressHTML: 'jsx', which drops the line break
  // between text and a following inline element instead of collapsing it to a
  // space — prose wrapped before an <a> or <code> would lose that space.
  compressHTML: true,
  markdown: {
    // Sätteri is the default processor; naming it here is what lets the base
    // plugin join its pipeline (see base-urls-plugin.mjs). The code theme
    // comes from @deramond.dev/astro: one dark theme, every colour AA on the
    // code panel.
    processor: satteri({ hastPlugins: [baseUrlsPlugin({ base })] }),
  },
  // `astro dev` serves the built demos from demo-dist/, with their chrome, so
  // the gallery and the compare view work locally (dev-demos-plugin.mjs).
  vite: { plugins: [devDemosPlugin({ base })] },
  integrations: [
    // The site's chrome, type, colours, docs shell, Open Graph cards,
    // favicons and search. Every page, the docs sidebar (src/nav.js), the
    // blog index (src/blog.js) and the raw-markdown and llms.txt routes stay
    // this site's own: `docs.route: false` and no `blog` option leave them
    // alone, and the integration only renders around them.
    deramond({
      site: {
        name: 'Transtyle',
        description:
          'Transtyle is a design system compiler: describe your design system once, compile native themes for every ecosystem.',
      },
      brand: {
        mark: './src/brand/mark.svg',
        favicons: './src/brand/favicons/',
        accounts: [{ label: 'GitHub', href: 'https://github.com/transtyle/transtyle' }],
        // The home page's schema.org identity is the project, not a person: an
        // Organization named after the site, at its home page, whose profile is
        // the repository above. The author stays the meta author and copyright.
        identity: { type: 'Organization' },
      },
      nav,
      // The footer: Footer reads it, so Base.astro passes nothing. `copyright`
      // and `meta` stay the package defaults.
      footer: {
        blurb: 'A design system compiler. MIT licensed.',
        columns: [
          {
            title: 'Project',
            links: [
              { label: 'Documentation', href: `${root}/docs/` },
              { label: 'Demos', href: `${root}/demo/` },
              { label: 'Compare', href: `${root}/compare/` },
              { label: 'GitHub', href: 'https://github.com/transtyle/transtyle' },
            ],
          },
          {
            title: 'Read',
            links: [
              { label: 'Blog', href: `${root}/blog/` },
              { label: 'RSS', href: `${root}/blog/rss.xml` },
              { label: 'AI agents', href: `${root}/docs/ai-agents/` },
              { label: 'llms.txt', href: `${root}/llms.txt` },
            ],
          },
        ],
      },
      // The author's other tools, in a quiet row of the docs footer; the same
      // list on each of them, each leaving itself out. "More by Julien
      // Déramond" (the default) ends the row.
      related: [
        {
          name: 'dtgraph',
          description: 'Interactive dependency graph for DTCG design tokens',
          href: 'https://julien-deramond.github.io/dtgraph/',
        },
        {
          name: 'Component Anatomy',
          description: 'Interactive component anatomy for design system docs',
          href: 'https://julien-deramond.github.io/component-anatomy/',
        },
        {
          name: 'Bootstrap Tokens',
          description: 'Bootstrap 6 as design tokens, with a theme builder',
          href: 'https://julien-deramond.github.io/bootstrap-tokens/',
        },
      ],
      // The site card (/og/index.png) prints its subtitle on one line, cut
      // with an ellipsis: the site description doesn't fit, so it gets the
      // same short line as the footer blurb and /og/default.png.
      og: { art: './src/brand/og-art.png', subtitle: 'A design system compiler' },
      docs: {
        route: false,
        tool: { version: `v${version}` },
        tabs: nav,
        edit: { repo: 'transtyle/transtyle', dir: 'website/src/docs' },
      },
    }),
  ],
});
