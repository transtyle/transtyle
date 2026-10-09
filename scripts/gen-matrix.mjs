#!/usr/bin/env node
/**
 * The slot matrix docs page (website/src/docs/slot-matrix.md): which targets
 * read each catalog slot, generated, never hand-edited (issue #95).
 *
 * A hand-kept table of "who consumes what" would be wrong by the next exporter
 * PR, and nothing would notice. So the page is compiled: Acme is built
 * in-process with one instance of each official exporter, every exporter's
 * reads are recorded while it emits (packages/cli/src/matrix.js, the code
 * behind `transtyle check --matrix`), and each cell is classed from the
 * coverage rows that name the slot. The rows are the catalog slots all four
 * examples share, so an example's own extra roles don't leak into a
 * reference page about the catalog.
 *
 * `--check` regenerates in memory and fails when the committed page differs:
 * the same bargain gen-figures.mjs makes. The page goes through prettier with
 * the repo's own config, so `check:format` and this check agree on its bytes.
 *
 * Run: node scripts/gen-matrix.mjs            (also: npm run gen:matrix)
 *      node scripts/gen-matrix.mjs --check    (also: npm run check:matrix)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { EXAMPLES, TARGETS } from './lib/demos.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(repo, 'website/src/docs/slot-matrix.md');
const check = process.argv.includes('--check');

const { compile } = await import('../packages/core/src/index.js');
const { recordingLoader, consumption, sections } = await import('../packages/cli/src/matrix.js');

const SOURCE = 'acme';
const targetIds = TARGETS.map((t) => t.id);

async function matrixOf(example, targets) {
  const { loadExporter, readSets } = recordingLoader(
    async (name) => (await import(`../packages/exporter-${name}/src/index.js`)).default,
  );
  const result = await compile({ cwd: join(repo, 'examples', example), targets, emit: false, loadExporter });
  if (result.diagnostics.errors.length > 0) {
    console.error(`✖ matrix: examples/${example} does not compile:`);
    for (const d of result.diagnostics.errors) console.error(`    ${d.code} ${d.message}`);
    process.exit(1);
  }
  return consumption(result, readSets);
}

/** The catalog slots an example resolves (no exporter needed for that). */
async function catalogOf(example) {
  const { normalized } = await compile({ cwd: join(repo, 'examples', example), emit: false, skipExporters: true });
  const out = new Set();
  for (const map of Object.values(normalized?.modes ?? {})) for (const k of map.keys()) out.add(k);
  return out;
}

const matrix = await matrixOf(SOURCE, targetIds);
const shared = new Set(Object.keys(matrix.slots));
for (const { id } of EXAMPLES) {
  if (id === SOURCE) continue;
  const other = await catalogOf(id);
  for (const slot of shared) if (!other.has(slot)) shared.delete(slot);
}
for (const slot of Object.keys(matrix.slots)) if (!shared.has(slot)) delete matrix.slots[slot];

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** Column headers: the gallery's titles, shortened so eight columns fit a docs page. */
const SHORT = { shadcn: 'shadcn', echarts: 'ECharts', radix: 'Radix', 'css-variables': 'CSS vars' };
const title = (id) => SHORT[id] ?? TARGETS.find((t) => t.id === id).title;
const readers = (slot) => matrix.targets.filter((t) => matrix.slots[slot][t]);
const n = matrix.targets.length;

/**
 * `semantic.color.primary` → "Color: primary"; `component.button` → "Component: button".
 * The colour slots that sit alone (`border`, `ring`, `scrim`) are named by their leaves.
 */
function heading(section, list) {
  const parts = section.split('.');
  if (parts[0] === 'component') return `Component: ${parts[1]}`;
  const group = parts[1][0].toUpperCase() + parts[1].slice(1);
  if (parts[2]) return `${group}: ${parts[2]}`;
  if (parts[1] === 'color') return `${group}: ${list.map((s) => s.split('.').pop()).join(', ')}`;
  return group;
}

/** A cell is the class word (never colour alone) after a swatch of the site's coverage colour. */
const CELL = { native: 'native', derived: 'derived', approximated: 'approx.', input: 'input' };
const SM = { native: 'native', derived: 'derived', approximated: 'approx', input: 'input' };
const cell0 = (c) => `<span class="sm ${SM[c]}">${CELL[c]}</span>`;
const cell = (slot, t) => {
  const c = matrix.slots[slot][t]?.class;
  return c ? `<span class="sm ${SM[c]}">${CELL[c]}</span>` : '';
};
/** Page-local styles: compact cells and slot names that never break mid-path. */
const STYLE = [
  '<style>',
  '  .sm { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; font: var(--font-size-xs) / 1 var(--font-family-mono); }',
  '  .sm::before { content: ""; inline-size: 8px; block-size: 8px; flex: none; background: var(--sm-c); }',
  '  .sm.native { --sm-c: var(--cov-native); }',
  '  .sm.derived { --sm-c: var(--cov-derived); }',
  '  .sm.approx { --sm-c: var(--cov-approx); }',
  '  .sm.input::before { background: none; outline: var(--stroke-hairline) solid var(--color-muted); outline-offset: -1px; }',
  '  .sm.input { color: var(--color-muted); }',
  '  td:first-child code, td:nth-child(2):not(:last-child) { white-space: nowrap; }',
  '  th:first-child:not(:last-child), td:first-child:not(:last-child) { position: sticky; inset-inline-start: 0; z-index: 1; background: var(--color-bg); }',
  '</style>',
];

const slots = Object.keys(matrix.slots);
const allList = slots.filter((s) => readers(s).length === n);
const all = allList.length;
const one = slots.filter((s) => readers(s).length === 1);
const onlyCss = one.filter((s) => readers(s)[0] === 'css-variables').length;
const none = slots.filter((s) => readers(s).length === 0).length;
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

const groups = sections(matrix);
const lines = [
  '---',
  "title: 'Slot matrix'",
  "description: 'Which targets read each catalog slot: a generated slot × target table, compiled from the exporters themselves.'",
  'order: 8',
  '---',
  '',
  '<!-- Generated by scripts/gen-matrix.mjs (npm run gen:matrix). Do not edit: check:matrix fails on any hand edit. -->',
  '',
  ...STYLE,
  '',
  '# Slot matrix',
  '',
  `Authoring a slot changes the targets that read it, and only those. This page answers "if I author \`elevation.3.surface\`, which libraries change?" for every slot of the [catalog](/docs/language/): one row per slot, one column per target.`,
  '',
  `It is compiled, not written. [Acme](/docs/examples/) is built with each of the ${n} exporters while the compiler records every slot each exporter reads, and each cell is classed from that exporter's [coverage report](/docs/concepts/). The rows are the ${slots.length} catalog slots all ${EXAMPLES.length} examples share. \`npm run gen:matrix\` regenerates the page and \`npm run check:matrix\` fails when it no longer matches the exporters.`,
  '',
  `For your own design system and targets, run \`transtyle check --matrix\` (add \`--json\` for a \`matrix\` key in the report, see the [CLI reference](/docs/cli/#--matrix)).`,
  '',
  '## Reading a cell',
  '',
  '| Cell      | Meaning                                                                                                                         |',
  '| --------- | ------------------------------------------------------------------------------------------------------------------------------- |',
  `| ${cell0('native')}  | A target variable maps to this slot one to one. |`,
  `| ${cell0('derived')} | A target variable is computed from this slot (a mix, a ramp step, a unit conversion). |`,
  `| ${cell0('approximated')} | A target variable is the closest fit to this slot, with a loss the coverage report spells out. |`,
  `| ${cell0('input')}   | The exporter reads the slot, but no coverage row names it: it feeds a value described under another slot or a pattern (a Radix ramp, a PrimeNG surface, a Bootstrap chained variable). |`,
  '| (empty)   | The target never reads the slot. Authoring it changes nothing there.                                                           |',
  '',
  'A read is counted whether or not the value ends up in the output, so the matrix errs on the safe side: an empty cell is a guarantee, a filled one is a dependency.',
  '',
  `${plural(all, 'slot')} ${all === 1 ? 'is' : 'are'} read by all ${n} targets${all > 0 && all <= 3 ? ` (${allList.map((s) => `\`${s}\``).join(', ')})` : ''}, ${plural(onlyCss, 'slot')} only by CSS variables (the reference dump, which emits every semantic slot), and ${none === 0 ? 'every slot is read by at least one target' : `${plural(none, 'slot')} ${none === 1 ? 'is' : 'are'} read by no target`}.`,
];

const header = ['Slot', 'Read by', ...matrix.targets.map(title)];
const short = (slot, section) => slot.slice(section.length + 1) || slot;
for (const [section, list] of groups) {
  const rows = list.filter((s) => shared.has(s));
  if (rows.length === 0) continue;
  lines.push('', `## ${heading(section, rows)}`, '', `Each slot below is \`${section}.<slot>\`.`, '');
  lines.push(`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`);
  for (const slot of rows) {
    lines.push(`| \`${short(slot, section)}\` | ${readers(slot).length}/${n} | ${matrix.targets.map((t) => cell(slot, t)).join(' | ')} |`);
  }
}
lines.push('');

const config = await prettier.resolveConfig(outFile);
const page = await prettier.format(lines.join('\n'), { ...config, filepath: outFile });

if (check) {
  if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== page) {
    console.error('✖ matrix: website/src/docs/slot-matrix.md no longer matches what the exporters read.');
    console.error('  Run `npm run gen:matrix` and commit the result.');
    process.exit(1);
  }
  console.log(`✔ matrix: slot-matrix.md matches a fresh compile (${slots.length} slots × ${n} targets)`);
} else {
  writeFileSync(outFile, page);
  console.log(`✔ matrix: wrote website/src/docs/slot-matrix.md (${slots.length} slots × ${n} targets)`);
}
