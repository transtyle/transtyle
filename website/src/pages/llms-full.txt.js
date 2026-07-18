/** llms-full.txt: the entire documentation concatenated as plain markdown. */
import { orderedSlugs } from '../nav.js';

const raws = import.meta.glob('../docs/*.md', { query: '?raw', import: 'default', eager: true });
const bySlug = Object.fromEntries(
  Object.entries(raws).map(([p, raw]) => [p.split('/').pop().replace('.md', ''), raw]),
);

const stripFrontmatter = (md) => md.replace(/^---\n[\s\S]*?\n---\n*/, '');

export function GET() {
  const body = orderedSlugs
    .map((slug) => stripFrontmatter(bySlug[slug]).trim())
    .join('\n\n---\n\n');
  const header = '<!-- Transtyle documentation, concatenated for LLM consumption. Source: https://transtyle.dev -->\n\n';
  return new Response(header + body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
