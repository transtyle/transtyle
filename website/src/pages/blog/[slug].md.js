/**
 * Serve every blog post as raw markdown at /blog/<slug>.md — same contract as
 * the docs pages (docs/ai-agents.md): source over chrome, for agents and for
 * anyone who wants to quote the post without scraping HTML.
 */
import { withBaseInMarkdown } from '../../url.js';

const raws = import.meta.glob('../../blog/*.md', { query: '?raw', import: 'default', eager: true });

export function getStaticPaths() {
  return Object.entries(raws).map(([p, raw]) => ({
    params: { slug: p.split('/').pop().replace('.md', '') },
    props: { raw },
  }));
}

export function GET({ props }) {
  return new Response(withBaseInMarkdown(props.raw), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
