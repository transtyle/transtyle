/**
 * Docs navigation — single source of truth for the sidebar, llms.txt,
 * llms-full.txt, and prev/next page links. Sections are labeled by doc kind
 * (D1, docs/plan/strategic-review-2026-07.md): Start here to get running,
 * Concepts to understand, Guides for tasks, Reference for lookup, Targets
 * per exporter, Project for status. check-docs.mjs enforces that every page
 * is reachable from here and every slug listed here exists.
 */
import { withBase } from './url.js';

export const sections = [
  { title: 'Start here', slugs: ['index', 'getting-started', 'adopt-existing'] },
  { title: 'Learn', slugs: ['what-is-a-design-token', 'how-transtyle-works', 'your-first-build'] },
  { title: 'Concepts', slugs: ['concepts', 'derivation', 'internals'] },
  { title: 'Guides', slugs: ['authoring-tokens', 'examples', 'govuk-showcase', 'write-an-exporter', 'ai-agents'] },
  { title: 'Reference', slugs: ['language', 'configuration', 'cli', 'diagnostics'] },
  { title: 'Targets', slugs: ['exporter-shadcn', 'exporter-daisyui', 'exporter-echarts', 'exporter-bootstrap', 'exporter-storybook', 'exporter-css-variables', 'exporter-radix', 'exporter-primeng'] },
  { title: 'Project', slugs: ['roadmap'] },
];

export const orderedSlugs = sections.flatMap((s) => s.slugs);

export const docPath = (slug) => withBase(slug === 'index' ? '/docs/' : `/docs/${slug}/`);

/**
 * The raw-markdown twin of a docs page (src/pages/docs/[slug].md.js).
 *
 * Not `docPath(slug) + '.md'`: that reads well until the index, where it
 * produces `/docs.md` — a 404 that sat in llms.txt, which is the one file whose
 * entire audience follows links without a human noticing they broke.
 */
export const docMdPath = (slug) => withBase(`/docs/${slug}.md`);
