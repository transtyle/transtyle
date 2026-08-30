/**
 * Base-path-aware URL builder for every internal link on the site.
 *
 * The site is deployed to a GitHub Pages *project* site, which serves it from
 * https://transtyle.github.io/transtyle/ — not from the domain root. So a
 * hand-written `href="/docs/"` is a 404 in production while working perfectly
 * in `astro dev`, which is the worst possible failure shape: invisible until
 * it is live. Every internal link goes through `withBase()` instead, and
 * scripts/check-site-links.mjs fails the build if one doesn't.
 *
 * `import.meta.env.BASE_URL` is Astro's own view of the configured `base`, so
 * this stays correct without reading the config: when transtyle.dev exists and
 * `base` goes back to '/', BASE_URL becomes '/' and every call here collapses
 * to the path it was given, with no other edit anywhere.
 *
 * Only internal, root-absolute paths belong here. External URLs, `#anchors`
 * and `mailto:` are left alone — prefixing those would break them.
 */

/** '/docs/' → '/transtyle/docs/' under a base, → '/docs/' without one. */
export const withBase = (path) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;

/**
 * The site's origin, for the absolute URLs feeds, sitemaps and OG tags need.
 *
 * `site` is always configured (astro.config.mjs), so there is deliberately no
 * fallback here: these endpoints used to carry a hardcoded `?? transtyle.dev`,
 * which is a quiet way to publish a feed full of URLs for a domain the site is
 * not served from. If `site` ever goes missing the build should stop.
 */
export const origin = (site) => site.toString().replace(/\/$/, '');

/**
 * Apply the base path to root-absolute links inside a markdown document.
 *
 * The docs are also served as raw markdown (`/docs/<slug>.md`, `llms-full.txt`)
 * for agents and for people who prefer source. Those files are the authored
 * text, and the authored text says `/docs/internals/` — correct at a domain
 * root, a 404 under a project Pages base. The rendered HTML gets this from the
 * Sätteri plugin; the raw text has no pipeline, so it gets it here.
 *
 * The same bargain the RSS feed already makes: a link that resolves for the
 * reader beats a byte-exact copy of the source.
 */
export const withBaseInMarkdown = (md) => {
  const prefix = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (prefix === '') return md;
  return md
    .replace(/\]\(\/(?!\/)/g, `](${prefix}/`)
    .replace(/\b(href|src)="\/(?!\/)/g, `$1="${prefix}/`);
};
