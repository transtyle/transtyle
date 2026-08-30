/**
 * Rewrite root-absolute links in markdown so they survive a base path.
 *
 * Docs and blog posts are authored with ordinary site paths — `/docs/roadmap/`,
 * `/llms.txt` — because that is what a markdown author should be able to write,
 * and because those files are also served raw at `/docs/<slug>.md` for agents,
 * where a build-time helper call would be noise. Components call withBase()
 * (src/url.js); markdown gets the same treatment applied here instead.
 *
 * This is a Sätteri hast plugin rather than a rehype one: Sätteri is Astro 7's
 * default Markdown processor, and setting `markdown.rehypePlugins` silently
 * demands the old unified pipeline back (`@astrojs/markdown-remark`), which
 * would swap out the whole renderer to prefix some hrefs.
 *
 * Deliberately narrow: only `href`/`src` values starting with a single `/`.
 * That leaves external URLs, protocol-relative `//host` ones, `#anchors` and
 * `mailto:` alone — prefixing any of those would break them.
 *
 * Two visitors, because the docs use both link forms. Markdown links become
 * `element` nodes; the hand-written HTML blocks in docs/index.md (the card grid)
 * arrive as one opaque `raw` node whose anchors the element visitor never sees.
 * Missing those was not hypothetical — it left five live 404s in the first
 * build under a base.
 */
const ATTR = { a: 'href', img: 'src', source: 'src', video: 'src', iframe: 'src' };

export function baseUrlsPlugin({ base }) {
  const prefix = base.replace(/\/$/, '');
  return {
    name: 'base-urls',
    element: {
      filter: Object.keys(ATTR),
      visit(node, ctx) {
        if (prefix === '') return;
        const attr = ATTR[node.tagName];
        const value = node.properties?.[attr];
        if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
          ctx.setProperty(node, attr, prefix + value);
        }
      },
    },
    raw(node, ctx) {
      if (prefix === '') return;
      const value = node.value.replace(/\b(href|src)="\/(?!\/)/g, `$1="${prefix}/`);
      if (value !== node.value) ctx.replaceNode(node, { type: 'raw', value });
    },
  };
}
