/**
 * Blog index — the single source of truth for the post list, shared by
 * /blog/, /blog/<slug>/, the raw-markdown route, llms.txt, and the
 * frontmatter guard in scripts/check-docs.mjs.
 *
 * A post is one markdown file in website/src/blog/. Its filename is its slug
 * (that's the published URL, so renaming a file breaks a link — don't).
 * Required frontmatter: title, description, date (YYYY-MM-DD), author.
 */
const modules = import.meta.glob('./blog/*.md', { eager: true });

/** Every post, newest first. */
export const posts = Object.entries(modules)
  .map(([path, mod]) => ({
    slug: path.split('/').pop().replace(/\.md$/, ''),
    ...mod.frontmatter,
    mod,
  }))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const postPath = (slug) => `/blog/${slug}/`;

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
