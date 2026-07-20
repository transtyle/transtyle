#!/usr/bin/env node
/**
 * The sync rule, mechanized (CONTRIBUTING.md "definition of done"):
 * a feature is not done until code, docs/, website, README, and examples agree.
 *
 * This checker enforces the part that's mechanically checkable. It walks the
 * CLI's OFFICIAL_EXPORTERS registry (the source of truth for "what shipped")
 * and asserts every exporter appears on every surface:
 *
 *   1. code      — packages/exporter-<name>/ exists and is wired in the CLI
 *   2. docs/     — docs/specs/exporters/<name>.md exists
 *   3. website   — website/src/docs/exporter-<name>.md exists, is in nav.js,
 *                  and the website roadmap's "Implemented today" section names it;
 *                  no page outside a status construct calls it "specced"
 *   4. README    — README.md names it
 *   5. examples  — every example's transtyle.config.json configures it (or an
 *                  exception is declared below), and its demo project exists
 *
 * Run: node scripts/check-sync.mjs   (also: npm run check:sync; runs before
 * site:build). Exits 1 with a list of violations. Extend it whenever a new
 * class of drift is discovered — this file exists because a real one was.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const fail = (msg) => errors.push(msg);

// Declared, reviewed exceptions — keep this list tiny and justified.
const EXCEPTIONS = {
  // (none currently)
};

// 1. code: the CLI registry is the source of truth
const cliSrc = read('packages/cli/src/main.js');
const registry = cliSrc.match(/OFFICIAL_EXPORTERS\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const exporters = [...registry.matchAll(/^\s*(\w[\w-]*):/gm)].map((m) => m[1]);
if (exporters.length === 0) fail('could not parse OFFICIAL_EXPORTERS from packages/cli/src/main.js');

const examples = readdirSync(join(root, 'examples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'examples', d.name, 'transtyle.config.json')))
  .map((d) => d.name);

const readme = read('README.md');
const nav = read('website/src/nav.js');
const siteRoadmap = read('website/src/docs/roadmap.md');
const implementedSection = siteRoadmap.split(/##\s+Specced/)[0];

// Display names that must appear in prose surfaces (registry key → accepted spellings)
const NAMES = {
  shadcn: ['shadcn'],
  daisyui: ['daisyui', 'daisyUI'],
  echarts: ['echarts', 'ECharts'],
  bootstrap: ['bootstrap', 'Bootstrap'],
  storybook: ['storybook', 'Storybook'],
};
const mentions = (text, name) => (NAMES[name] ?? [name]).some((n) => text.includes(n));

for (const name of exporters) {
  const pkg = `packages/exporter-${name}`;
  if (!existsSync(join(root, pkg))) fail(`${name}: missing ${pkg}/ (code surface)`);
  if (!existsSync(join(root, `docs/specs/exporters/${name}.md`))) fail(`${name}: missing docs/specs/exporters/${name}.md (docs surface)`);

  const sitePage = `website/src/docs/exporter-${name}.md`;
  if (!existsSync(join(root, sitePage))) fail(`${name}: missing ${sitePage} (website surface)`);
  if (!nav.includes(`'exporter-${name}'`)) fail(`${name}: not listed in website/src/nav.js Targets section (website surface)`);
  if (!mentions(implementedSection, name)) fail(`${name}: not named in the "Implemented today" table of website/src/docs/roadmap.md (website surface)`);
  if (!mentions(readme, name)) fail(`${name}: not named in README.md (README surface)`);

  for (const ex of examples) {
    if (EXCEPTIONS[`${ex}:${name}`]) continue;
    const config = read(`examples/${ex}/transtyle.config.json`);
    if (!config.includes(`"${name}"`) && !config.includes(`"exporter": "${name}"`)) {
      fail(`${name}: not configured in examples/${ex}/transtyle.config.json (examples surface)`);
    }
    if (!existsSync(join(root, `examples/${ex}/demo/${name}`))) {
      fail(`${name}: missing demo project examples/${ex}/demo/${name}/ (examples surface, docs/specs/demo-app.md)`);
    }
  }
}

// 3b. website prose may not call a shipped exporter "specced"/"not yet implemented"
// outside the roadmap page (the allowed status construct).
for (const file of readdirSync(join(root, 'website/src/docs'))) {
  if (file === 'roadmap.md') continue;
  const text = read(`website/src/docs/${file}`);
  for (const name of exporters) {
    for (const line of text.split('\n')) {
      if (mentions(line, name) && /specced|not yet implemented|\(soon\)|planned/i.test(line)) {
        // tolerate lines about OTHER features that merely mention the target name
        if (new RegExp(`(${(NAMES[name] ?? [name]).join('|')})[^.]{0,40}(specced|not yet implemented|soon|planned)`, 'i').test(line)) {
          fail(`${file}: calls shipped exporter "${name}" unimplemented → "${line.trim().slice(0, 100)}"`);
        }
      }
    }
  }
}

// Landing page chips: a shipped exporter must not carry the "soon" class.
const landing = read('website/src/pages/index.astro');
for (const name of exporters) {
  for (const spelled of NAMES[name] ?? [name]) {
    if (new RegExp(`class="chip soon">\\s*(Apache )?${spelled}\\s*<`, 'i').test(landing)) {
      fail(`index.astro: shipped exporter "${name}" still has a "soon" chip`);
    }
  }
}

if (errors.length) {
  console.error(`✖ sync check failed — ${errors.length} violation(s) of the CONTRIBUTING sync rule:\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✔ sync check: ${exporters.length} exporters (${exporters.join(', ')}) present on all five surfaces across ${examples.length} examples`);
