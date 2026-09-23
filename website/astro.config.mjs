// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import deramond from '@deramond.dev/astro/integration';
import { baseUrlsPlugin } from './base-urls-plugin.mjs';

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
      },
      nav: [
        { label: 'Docs', href: `${root}/docs/` },
        { label: 'Demos', href: `${root}/demo/` },
        { label: 'Compare', href: `${root}/compare/` },
        { label: 'Blog', href: `${root}/blog/` },
      ],
      og: { art: './src/brand/og-art.png' },
      docs: {
        route: false,
        tool: { version: `v${version}` },
        tabs: [
          { label: 'Docs', href: `${root}/docs/` },
          { label: 'Demos', href: `${root}/demo/` },
          { label: 'Compare', href: `${root}/compare/` },
          { label: 'Blog', href: `${root}/blog/` },
        ],
        edit: { repo: 'transtyle/transtyle', dir: 'website/src/docs' },
      },
    }),
  ],
});
