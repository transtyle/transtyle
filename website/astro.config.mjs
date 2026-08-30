// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
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
const base = process.env.SITE_BASE ?? '/transtyle';

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

export default defineConfig({
  site,
  base,
  redirects: MERGED_POSTS,
  markdown: {
    // Sätteri is the default processor; naming it here is what lets the base
    // plugin join its pipeline (see base-urls-plugin.mjs).
    processor: satteri({ hastPlugins: [baseUrlsPlugin({ base })] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
