/**
 * Blog index — the single source of truth for the post list, shared by
 * /blog/, /blog/<slug>/, the raw-markdown route, llms.txt, and the
 * frontmatter guard in scripts/check-docs.mjs.
 *
 * A post is one markdown file in website/src/blog/. Its filename is its slug
 * (that's the published URL, so renaming a file breaks a link — don't).
 * Required frontmatter: title, description, date (YYYY-MM-DD), author.
 */
import { withBase } from './url.js';

const modules = import.meta.glob('./blog/*.md', { eager: true });

/** Every post, newest first. */
export const posts = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.split('/').pop().replace(/\.md$/, ''),
    ...mod.frontmatter,
    mod,
  }))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const postPath = (slug) => withBase(`/blog/${slug}/`);

/**
 * The hue a post's social card is tinted with, in OKLCH degrees.
 *
 * Derived from the slug unless the post authors `accentHue`, which is the
 * compiler's own bargain applied to its blog: a deterministic rule fills what
 * you didn't decide, and authoring beats the rule. The eight rungs are 45°
 * apart starting at the brand hue, so consecutive posts land far enough apart
 * to be told apart in a feed, and every post keeps the same hue forever.
 *
 * The brand hue is the blue end of the mark's gradient (#6B8DFF) in OKLCH —
 * the same number global.css and og.js hold, and the one check-brand.mjs
 * recomputes from brand/transtyle-mark.svg to keep all three honest.
 */
const BRAND_HUE = 269;
export const accentHue = (post) => {
  if (post.accentHue !== undefined) return post.accentHue;
  let hash = 0;
  for (const ch of post.slug) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return (BRAND_HUE + 45 * (hash % 8)) % 360;
};

/**
 * Dates are authored as plain `YYYY-MM-DD` strings and formatted in UTC —
 * a local-timezone render of a bare date lands on the previous day west of
 * Greenwich, which is a silly way to misdate a release post.
 */
export const formatDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
