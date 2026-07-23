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
const exporters = [...registry.matchAll(/^\s*['"]?([\w-]+)['"]?:/gm)].map((m) => m[1]);
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
  'css-variables': ['css-variables'],
  radix: ['radix', 'Radix'],
  primeng: ['primeng', 'PrimeNG'],
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

// 6. Dead-vocabulary guard (docs/plan/catalog-revision.md T3): the pre-revision
// catalog's slot names must not survive in code, example tokens/configs, or
// website docs — one vocabulary, no aliases (ADR-0010). Docs that *describe*
// the migration (historical record, before/after mapping) are excluded by
// name, not by pattern — keep this list tiny and reviewed.
// Two spellings of every old name must be caught: the DOTTED path a code/prose
// reference uses (`semantic.color.primary.base`) and the NESTED-JSON form a token
// file or a docs code-fence uses (`"primary": { "base": … }`). The dotted patterns
// alone missed the JSON form twice this session (primary.base, surface.base in the
// docs), so each old shape now has a nested-JSON companion below.
//
// Discriminating dead vocab from legitimate custom vocab: every removed color/surface
// slot carried an old grid *cell* (`.base`/`.hover`/`.active`/`.subtle`/`.contrast`),
// whereas (a) the new elevation leaf is `"surface": { "$value": … }` and (b) a design
// system's own custom token (e.g. Carbon's `semantic.color.carbon.background`) holds a
// `$value` directly. So the nested-JSON patterns REQUIRE an old cell child — a bare
// `"background": { "$value" }` is left alone, an old `"background": { "base" }` is not.
const DEAD_VOCAB = [
  { name: 'text-on-<role> foreground slots', re: /text-on-/ },
  // (?<!text): text.subtle is a legitimate new content-hierarchy rung, not the old grid cell
  { name: '.subtle color scale slot', re: /(?<!text)\.subtle\b/ },
  { name: 'surface-raised slot', re: /surface-raised/ },
  // ---- dotted-path forms (code, prose, config values) ----
  // The nested-JSON form of this pattern already excused `text.base` and the
  // `link.*` cells as current vocabulary; the dotted form did not, so writing a
  // real slot's fully-qualified path in prose tripped the guard (found in AL4,
  // documenting `semantic.color.text.base` in a config example). Same two
  // exceptions, now stated in both forms.
  { name: '<role>.base / .hover / .active / .contrast (old grid, dotted path)', re: /semantic\.color\.(?!text\.base\b|link\.(base|hover)\b)[a-z][\w-]*\.(base|hover|active|contrast)\b/ },
  { name: 'background.base / surface.base / overlay.base (old surface slots, dotted path)', re: /semantic\.color\.(background|surface|overlay)\.base\b/ },
  { name: 'text-muted.base (old content slot, dotted path)', re: /semantic\.color\.text-muted\.base\b/ },
  // ---- nested-JSON forms (token files, docs code-fences) ----
  // A color role directly holding an old grid cell — text.base / link.{base,hover,visited}
  // are NOT color roles, so they can never match this (that's why the role set is explicit).
  { name: '<role> with an old grid cell (base/hover/active/subtle/contrast), JSON-nested', re: /"(primary|secondary|accent|success|warning|danger|info|neutral)"\s*:\s*\{[^{}]*"(base|hover|active|subtle|contrast)"\s*:/ },
  // Old surface/content slots that still carry a `.base` child (the new elevation leaf
  // and custom `<system>.background` tokens hold `$value` directly, so they don't match).
  { name: 'background/surface/overlay/text-muted old .base slot, JSON-nested', re: /"(background|surface|overlay|text-muted)"\s*:\s*\{[^{}]*"base"\s*:/ },
];
const DEAD_VOCAB_EXCLUDE_FILES = [
  // Explains the old->new mapping by name; excluded from the pattern guard,
  // reviewed by hand instead. Keep this list tiny.
];
const deadVocabHits = (text) => DEAD_VOCAB.some(({ re }) => re.test(text));
function scanDeadVocab(relPath, text) {
  if (DEAD_VOCAB_EXCLUDE_FILES.includes(relPath)) return;
  for (const { name, re } of DEAD_VOCAB) {
    const m = re.exec(text);
    if (m) fail(`${relPath}: dead vocabulary "${name}" found (matched "${m[0]}") — the catalog was revised, see ADR-0010`);
  }
}

// Guard the guard: the DEAD_VOCAB patterns are the contract, so their behavior is
// tested against fixtures. Weaken a pattern (or a false positive creep in) and this
// fails immediately, before the file scan — so the guard can't silently rot. Each
// MUST_MATCH is a real old spelling; each MUST_NOT is current vocab that once tripped
// a naive pattern (text.base, link.hover, the elevation leaf, custom `<sys>.background`).
const DEAD_VOCAB_MUST_MATCH = [
  'semantic.color.primary.base',
  '"primary": { "base": { "$value": "x" } }',
  '"danger": { "solid-hover-was": 0, "hover": {} }',
  '"surface": { "base": { "$value": "x" } }',
  '"background": { "base": { "$value": "x" } }',
  '"text-muted": { "base": { "$value": "x" } }',
  'text-on-primary.base',
  'primary.subtle',
  'surface-raised.base',
];
const DEAD_VOCAB_MUST_NOT = [
  '"primary": { "solid": { "$value": "x" } }',
  '"text": { "base": { "$value": "x" } }',           // text.base is a real ladder rung
  '"link": { "base": {}, "hover": {}, "visited": {} }', // link cells are current vocab
  '"elevation": { "1": { "surface": { "$value": "x" } } }', // new elevation leaf
  '"carbon": { "background": { "$value": "x" } }',    // custom token, holds $value directly
  'semantic.color.text.subtle',                       // text.subtle is a real content rung
  'semantic.color.text.base',                         // dotted form of the ladder rung above
  'semantic.color.link.base',                         // dotted form of the link cells above
  'semantic.color.link.hover',
];
for (const s of DEAD_VOCAB_MUST_MATCH) {
  if (!deadVocabHits(s)) fail(`dead-vocab self-test: expected a pattern to catch ${JSON.stringify(s)} but none did (a pattern was weakened)`);
}
for (const s of DEAD_VOCAB_MUST_NOT) {
  if (deadVocabHits(s)) fail(`dead-vocab self-test: a pattern falsely matched legitimate vocab ${JSON.stringify(s)} (false positive)`);
}
function walkFiles(dir, filter) {
  const out = [];
  for (const d of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, d.name);
    if (d.isDirectory()) { if (d.name !== 'node_modules' && d.name !== 'dist') out.push(...walkFiles(rel, filter)); }
    else if (filter(d.name)) out.push(rel);
  }
  return out;
}
for (const rel of walkFiles('packages', (n) => n.endsWith('.js'))) scanDeadVocab(rel, read(rel));
for (const ex of examples) {
  for (const rel of walkFiles(`examples/${ex}/tokens`, (n) => n.endsWith('.json'))) scanDeadVocab(rel, read(rel));
  const configRel = `examples/${ex}/transtyle.config.json`;
  scanDeadVocab(configRel, read(configRel));
}
for (const rel of walkFiles('website/src/docs', (n) => n.endsWith('.md'))) scanDeadVocab(rel, read(rel));
// The homepage and layouts reference catalog vocab too (e.g. the token showcase) —
// scan the rest of the site's authored sources so dead names can't hide there.
for (const rel of walkFiles('website/src/pages', (n) => n.endsWith('.astro'))) scanDeadVocab(rel, read(rel));

if (errors.length) {
  console.error(`✖ sync check failed — ${errors.length} violation(s) of the CONTRIBUTING sync rule:\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✔ sync check: ${exporters.length} exporters (${exporters.join(', ')}) present on all five surfaces across ${examples.length} examples; no dead catalog vocabulary found`);
