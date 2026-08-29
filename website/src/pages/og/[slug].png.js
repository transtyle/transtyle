/**
 * One Open Graph card per page, generated at build time.
 *
 *   /og/default.png            — the site card (homepage, blog index, fallback)
 *   /og/docs-<slug>.png        — a documentation page
 *   /og/blog-<slug>.png        — a blog post
 *
 * The slug set is derived from the same sources the pages themselves are built
 * from, so a new page cannot ship without its card. Base.astro maps a page to
 * its card via the `image` prop.
 */
import { orderedSlugs } from '../../nav.js';
import { posts, formatDate } from '../../blog.js';
import { renderCard } from '../../og.js';

const docs = import.meta.glob('../../docs/*.md', { eager: true });
const docFrontmatter = Object.fromEntries(
  Object.entries(docs).map(([p, m]) => [p.split('/').pop().replace('.md', ''), m.frontmatter]),
);

export function getStaticPaths() {
  return [
    {
      params: { slug: 'default' },
      props: { kicker: 'Design system compiler', title: 'One design system. Every ecosystem.', footer: 'Compile native themes for eight ecosystems' },
    },
    ...orderedSlugs.map((slug) => ({
      params: { slug: `docs-${slug}` },
      props: { kicker: 'Docs', title: docFrontmatter[slug].title, footer: docFrontmatter[slug].description },
    })),
    ...posts.map((post) => ({
      params: { slug: `blog-${post.slug}` },
      props: { kicker: 'Blog', title: post.title, footer: `${formatDate(post.date)} · ${post.author}` },
    })),
  ];
}

export async function GET({ props }) {
  const png = await renderCard(props);
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
