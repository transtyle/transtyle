/**
 * sitemap.xml — every indexable page of the site, enumerated from the same
 * sources the pages are built from (nav.js for docs, the post glob for the
 * blog), so a page cannot exist without appearing here.
 *
 * Hand-rolled for the same reason as the RSS feed: this is a list of URLs in
 * a fixed envelope, not a problem worth a dependency.
 *
 * Deliberately excluded: the raw-markdown routes (`/docs/<slug>.md`,
 * `/blog/<slug>.md`), llms.txt, the OG cards, and the 32 demo applications
 * under /demo/<example>/<target>/ — those are one page rendered 32 ways and
 * ship a noindex tag; the gallery that indexes them is the page to crawl. They're alternate
 * representations of pages already listed — submitting them invites duplicate-
 * content grading of the same text.
 *
 * `lastmod` is only claimed where the site actually knows it: a post's own
 * date. Docs pages have no reliable timestamp at build time (file mtimes
 * differ per clone, and a fabricated "today" on every build is worse than
 * saying nothing), so they're listed without one.
 */
import { orderedSlugs, docPath } from '../nav.js';
import { origin, withBase } from '../url.js';
import { posts, postPath } from '../blog.js';

export function GET({ site }) {
  const base = origin(site);

  const urls = [
    { loc: withBase('/'), priority: '1.0' },
    ...orderedSlugs.map((slug) => ({ loc: docPath(slug), priority: slug === 'index' ? '0.9' : '0.8' })),
    { loc: withBase('/demo/'), priority: '0.9' },
    { loc: withBase('/compare/'), priority: '0.7' },
    { loc: withBase('/blog/'), priority: '0.7' },
    ...posts.map((post) => ({ loc: postPath(post.slug), lastmod: post.date, priority: '0.7' })),
  ];

  const body = urls
    .map(({ loc, lastmod, priority }) =>
      [
        '  <url>',
        `    <loc>${base}${loc}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        `    <priority>${priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
