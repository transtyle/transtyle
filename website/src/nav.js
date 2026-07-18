/** Docs navigation — single source of truth for the sidebar, llms.txt, and llms-full.txt. */
export const sections = [
  { title: 'Start here', slugs: ['index', 'getting-started'] },
  { title: 'Guide', slugs: ['concepts', 'authoring-tokens', 'configuration', 'derivation', 'cli'] },
  { title: 'Targets', slugs: ['exporter-shadcn'] },
  { title: 'AI', slugs: ['ai-agents'] },
  { title: 'Deep dives', slugs: ['examples', 'diagnostics', 'roadmap', 'internals'] },
];

export const orderedSlugs = sections.flatMap((s) => s.slugs);

export const docPath = (slug) => (slug === 'index' ? '/docs/' : `/docs/${slug}/`);
