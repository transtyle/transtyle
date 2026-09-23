/**
 * One Open Graph card per page, generated at build time.
 *
 *   /og/index.png              — the site card (made by @deramond.dev/astro)
 *   /og/default.png            — the same card at its old address, which
 *                                link previews already posted still point to
 *   /og/docs-<slug>.png        — a documentation page
 *   /og/blog-<slug>.png        — a blog post
 *
 * The slug set is derived from the same sources the pages themselves are built
 * from, so a new page cannot ship without its card. Base.astro maps a page to
 * its card via the `image` prop; a page without one gets the site card.
 *
 * The card itself is @deramond.dev/astro's: the site's mark, the title, and
 * the site's artwork (src/brand/og-art.png) in the right panel.
 */
import config from 'virtual:deramond/config';
import { ogResponse } from '@deramond.dev/astro/og';
import { orderedSlugs } from '../../nav.js';
import { posts, formatDate } from '../../blog.js';

const docs = import.meta.glob('../../docs/*.md', { eager: true });
const docFrontmatter = Object.fromEntries(
  Object.entries(docs).map(([p, m]) => [p.split('/').pop().replace('.md', ''), m.frontmatter]),
);


export function getStaticPaths() {
  return [
    {
      params: { slug: 'default' },
      props: { kind: 'site', name: 'Transtyle', title: 'One design system.', accent: 'Every ecosystem.', subtitle: 'A design system compiler' },
    },
    ...orderedSlugs.map((slug) => ({
      params: { slug: `docs-${slug}` },
      props: { eyebrow: { label: 'Docs' }, title: docFrontmatter[slug].title, sub: docFrontmatter[slug].description },
    })),
    ...posts.map((post) => ({
      params: { slug: `blog-${post.slug}` },
      props: { eyebrow: { label: `Blog · ${post.date}` }, title: post.title, sub: post.description, meta: post.author },
    })),
  ];
}

export function GET({ props, site }) {
  return ogResponse({
    ...props,
    url: `${site.host}${config.base}`.replace(/\/$/, ''),
    art: config.og.art,
    mark: config.brand.mark,
  });
}
