/**
 * Serve every docs page as raw markdown at /docs/<slug>.md — for AI agents
 * and anyone who prefers source over chrome (docs/ai-agents.md).
 */
const raws = import.meta.glob('../../docs/*.md', { query: '?raw', import: 'default', eager: true });

export function getStaticPaths() {
  return Object.entries(raws).map(([p, raw]) => ({
    params: { slug: p.split('/').pop().replace('.md', '') },
    props: { raw },
  }));
}

export function GET({ props }) {
  return new Response(props.raw, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
