/**
 * The blog feed — RSS 2.0 at /blog/rss.xml, with full post content in
 * `content:encoded` so a reader shows the whole article, not a teaser.
 *
 * Hand-rolled rather than pulled from a package: a feed is a few hundred bytes
 * of XML with two rules that matter (escape the text, make every URL absolute),
 * and this repo's habit is to write the small thing rather than depend on it —
 * same call as the zero-dependency JSON-schema validator in packages/core.
 */
import { posts, postPath } from '../../blog.js';

const raws = import.meta.glob('../../blog/*.md', { eager: true });
const compiledBySlug = Object.fromEntries(
  Object.entries(raws).map(([p, m]) => [p.split('/').pop().replace('.md', ''), m]),
);

const escapeXml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** RFC 822, which is what RSS 2.0 requires — not ISO 8601. */
const rfc822 = (date) => new Date(`${date}T00:00:00Z`).toUTCString();

/**
 * Feed readers resolve relative URLs inconsistently (some against the feed URL,
 * some not at all), so every in-page link and image is absolutized here.
 */
const absolutize = (html, base) =>
  html.replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`);

export async function GET({ site }) {
  const base = (site ?? 'https://transtyle.dev').toString().replace(/\/$/, '');
  const items = (
    await Promise.all(
      posts.map(async (post) => {
        const url = `${base}${postPath(post.slug)}`;
        // compiledContent() is async in current Astro — it returns the rendered
        // HTML, not a string synchronously.
        const content = absolutize(await compiledBySlug[post.slug].compiledContent(), base);
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <dc:creator>${escapeXml(post.author)}</dc:creator>
      <description>${escapeXml(post.description)}</description>
      <content:encoded><![CDATA[${content.replaceAll(']]>', ']]&gt;')}]]></content:encoded>
    </item>`;
      }),
    )
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Transtyle</title>
    <link>${base}/blog/</link>
    <atom:link href="${base}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Releases, design decisions, and findings from compiling real design systems into real ecosystems.</description>
    <language>en</language>
    <docs>https://www.rssboard.org/rss-specification</docs>
${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
