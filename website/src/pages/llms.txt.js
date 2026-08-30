/** llms.txt (https://llmstxt.org): compact, agent-oriented index of the documentation. */
import { sections, docMdPath } from '../nav.js';
import { posts } from '../blog.js';
import { origin, withBase } from '../url.js';
import { EXAMPLES, TARGETS, discoverDemos, repoRoot } from '../../../scripts/lib/demos.mjs';

// Counted, not typed: the same list the gallery page and the deploy build from.
const demoCount = discoverDemos(repoRoot()).length;

const mods = import.meta.glob('../docs/*.md', { eager: true });
const bySlug = Object.fromEntries(
  Object.entries(mods).map(([p, m]) => [p.split('/').pop().replace('.md', ''), m.frontmatter]),
);

export function GET({ site }) {
  const base = origin(site);
  const lines = [
    '# Transtyle',
    '',
    '> Transtyle is a design system compiler: describe a design system once as W3C (DTCG) design tokens, and compile native, idiomatic theme artifacts for many ecosystems (shadcn/ui, daisyUI, Bootstrap, Apache ECharts, Storybook today). Deterministic builds, explainable derivation, coverage reporting, zero runtime. Designed to be operated by AI agents: config is JSON, diagnostics have stable codes, every build emits report.json.',
    '',
    'Every docs page is also available as raw markdown by appending `.md` to its URL. The full documentation as one file: ' + base + withBase('/llms-full.txt'),
    '',
    `Live output: ${demoCount} running applications at ${base}${withBase('/demo/')} — ${EXAMPLES.length} design systems (two invented, plus the real GOV.UK and IBM Carbon systems) each compiled to all ${TARGETS.length} targets. Within a target the page is byte-identical across design systems, so the difference between two of them is exactly what the compiler produced.`,
    '',
  ];
  for (const section of sections) {
    lines.push(`## ${section.title}`, '');
    for (const slug of section.slugs) {
      const fm = bySlug[slug];
      lines.push(`- [${fm.title}](${base}${docMdPath(slug)}): ${fm.description}`);
    }
    lines.push('');
  }
  if (posts.length) {
    lines.push('## Blog', '');
    for (const post of posts) {
      lines.push(`- [${post.title}](${base}${withBase(`/blog/${post.slug}.md`)}) — ${post.date}: ${post.description}`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
