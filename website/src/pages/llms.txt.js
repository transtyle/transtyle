/** llms.txt (https://llmstxt.org): compact, agent-oriented index of the documentation. */
import { sections, docPath } from '../nav.js';

const mods = import.meta.glob('../docs/*.md', { eager: true });
const bySlug = Object.fromEntries(
  Object.entries(mods).map(([p, m]) => [p.split('/').pop().replace('.md', ''), m.frontmatter]),
);

export function GET({ site }) {
  const base = (site ?? 'https://transtyle.dev').toString().replace(/\/$/, '');
  const lines = [
    '# Transtyle',
    '',
    '> Transtyle is a design system compiler: describe a design system once as W3C (DTCG) design tokens, and compile native, idiomatic theme artifacts for many ecosystems (shadcn/ui, daisyUI, Bootstrap, Apache ECharts, Storybook today). Deterministic builds, explainable derivation, coverage reporting, zero runtime. Designed to be operated by AI agents: config is JSON, diagnostics have stable codes, every build emits report.json.',
    '',
    'Every docs page is also available as raw markdown by appending `.md` to its URL. The full documentation as one file: ' + base + '/llms-full.txt',
    '',
  ];
  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    for (const slug of section.slugs) {
      const fm = bySlug[slug];
      lines.push(`- [${fm.title}](${base}${docPath(slug).replace(/\/$/, '')}.md): ${fm.description}`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
