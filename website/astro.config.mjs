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

export default defineConfig({
  site,
  base,
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
