#!/usr/bin/env node
/**
 * Acceptance check for Tokens Studio exports as input (issue #52, ADR-0014,
 * docs/specs/configuration.md#tokens-studio-exports).
 *
 * The fixture (packages/core/test-fixtures/tokens-studio/) is written by hand in
 * Tokens Studio's export shape, not copied from a design system: sets `core`,
 * `semantic/light` and `semantic/dark`, themes `Light` / `Dark` in a `Mode`
 * group, `$metadata.json`. It holds the dialect a real export carries: a
 * `.value` reference, math (`{space.base} * 4`, `roundTo(…)`), `rgba({ref}, a)`,
 * unitless pixel numbers, `fontSizes`, a `boxShadow` with `x`/`y`, a Figma
 * style name as a font weight, percentages for line height, letter spacing
 * and opacity, `$type` on tokens rather than groups. The same data is there
 * three more times: as a single-file export, in the legacy format
 * (`value`/`type`, `.value` on every reference), and rewritten by hand as
 * plain DTCG plus a mode-scoped layer (`dtcg/`).
 *
 * Asserts:
 *   1. every form compiles on every target instance of the fixture with no
 *      error, and only the expected notes;
 *   2. the folder, single-file and legacy forms emit byte-identical files to
 *      the plain DTCG twin, on every target: the proof that the lowering
 *      (themes → base layer + mode overlays) and the dialect conversions mean
 *      what the hand-written DTCG means;
 *   3. `transtyle explain` names the set file and the Tokens Studio path, per
 *      mode, and shows a math token's expression;
 *   4. a two-group export (mode × density) lowers to two dimensions, and one
 *      whose groups interact is refused (TST1008);
 *   5. one failing export per new code, each asserting its code;
 *   6. the expression evaluator on its own (subset, units, rounding).
 *
 * Run: node scripts/check-tokens-studio.mjs (also: npm run check:tokens-studio).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@transtyle/core';
import { evaluateExpression, ExpressionError } from '../packages/core/src/expressions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'packages/core/test-fixtures/tokens-studio');
const cli = join(root, 'packages/cli/src/main.js');
const errors = [];
const expect = (label, ok, detail = '') => { if (!ok) errors.push(`${label}${detail ? `\n      ${detail}` : ''}`); };
const loadExporter = async (name) => (await import(`@transtyle/exporter-${name}`)).default;
const exporterOf = (cwd) => {
  const config = JSON.parse(readFileSync(join(cwd, 'transtyle.config.json'), 'utf8'));
  return (instance) => loadExporter(config.targets[instance]?.exporter ?? instance);
};
const build = (cwd) => compile({ cwd, emit: false, loadExporter: exporterOf(cwd) });
const codes = (r) => r.diagnostics.items.map((d) => d.code);

// ---------- 1 + 2: four forms, one output ----------
// Expected notes on every form: the danger role carries over to dark (TST1204,
// the fixture authors no dark red), and the option-hygiene infos.
const NOTES = new Set(['TST1204', 'TST1114', 'TST1115']);
const forms = { folder: fixture, 'single file': join(fixture, 'single-file'), legacy: join(fixture, 'legacy'), 'plain DTCG': join(fixture, 'dtcg') };
const results = {};
for (const [label, cwd] of Object.entries(forms)) {
  const r = await build(cwd);
  results[label] = r;
  expect(`${label}: compiles with no error`, r.diagnostics.errors.length === 0, r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('\n      '));
  const allowed = label === 'legacy' ? new Set([...NOTES, 'TST1005']) : NOTES;
  const extra = codes(r).filter((c) => !allowed.has(c));
  expect(`${label}: no unexpected diagnostic (no TST1103 between sets, no TST1305/TST1306 for Tokens Studio names)`, extra.length === 0, extra.join(', '));
}
expect('legacy: one TST1005 per set file', codes(results.legacy).filter((c) => c === 'TST1005').length === 3, codes(results.legacy).join(', '));

const files = (r) => new Map(r.results.flatMap((t) => (t.emitted ?? []).map((f) => [`${t.target}/${f.path}`, f.contents])));
const twin = files(results['plain DTCG']);
expect('plain DTCG twin: every target emitted files', results['plain DTCG'].results.length === 12 && twin.size > 0, `${results['plain DTCG'].results.length} targets, ${twin.size} files`);
let compared = 0;
for (const label of ['folder', 'single file', 'legacy']) {
  const got = files(results[label]);
  const differ = [...new Set([...twin.keys(), ...got.keys()])].filter((k) => twin.get(k) !== got.get(k));
  compared += got.size;
  expect(`${label}: byte-identical to the plain DTCG twin on every target`, differ.length === 0, `differs: ${differ.slice(0, 8).join(', ')}`);
}

// ---------- 3: explain ----------
const run = (args) => {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
{
  const light = run(['explain', 'semantic.color.action.default', '--cwd', fixture]);
  expect('explain names the light set file and the Tokens Studio path', /from export\/semantic\/light\.json:\d+:\d+ \(Tokens Studio set "semantic\/light", color\.action\.default\)/.test(light.out), light.out);
  const dark = run(['explain', 'semantic.color.action.default', '--mode', 'dark', '--cwd', fixture]);
  expect('explain --mode dark names the dark set file', /from export\/semantic\/dark\.json:\d+:\d+ \(Tokens Studio set "semantic\/dark"/.test(dark.out), dark.out);
  const bound = run(['explain', 'semantic.color.primary.solid', '--cwd', fixture]);
  expect('explain of a bound catalog slot follows the alias to the set file', /aliased → semantic\.color\.action\.default\n.*\n\s+from export\/semantic\/light\.json:\d+:\d+ \(Tokens Studio set "semantic\/light", color\.action\.default\)/.test(bound.out), bound.out);
  const math = run(['explain', 'option.space.md', '--cwd', fixture]);
  expect('explain shows a math token\'s value and expression', /^option\.space\.md = 16px$/m.test(math.out) && /authored {2}← \{option\.space\.base\} \* 4/.test(math.out), math.out);
  const single = run(['explain', 'option.radius.md', '--cwd', join(fixture, 'single-file')]);
  expect('explain on a single-file export names the file and the set', /^option\.radius\.md = 7px$/m.test(single.out) && /from tokens\.json:\d+:\d+ \(Tokens Studio set "core", radius\.md\)/.test(single.out), single.out);
}

// ---------- 4 + 5: exports written for one case each ----------
const t = (type, value) => ({ $type: type, $value: value });
const BASE_SETS = {
  core: { color: { white: t('color', '#ffffff'), ink: t('color', '#111827'), blue: t('color', '#2563eb') }, space: { base: t('spacing', '4') } },
  light: { color: { bg: t('color', '{color.white}'), fg: t('color', '{color.ink}'), action: t('color', '{color.blue}') } },
  dark: { color: { bg: t('color', '{color.ink}'), fg: t('color', '{color.white}'), action: t('color', '{color.blue}') } },
};
const THEMES = [
  { id: 'l', name: 'Light', group: 'Mode', selectedTokenSets: { core: 'source', light: 'enabled', dark: 'disabled' } },
  { id: 'd', name: 'Dark', group: 'Mode', selectedTokenSets: { core: 'source', light: 'disabled', dark: 'enabled' } },
];
const BINDINGS = { semantic: { color: { primary: { solid: { $value: '{semantic.color.action}' } }, text: { base: { $value: '{semantic.color.fg}' } }, elevation: { 0: { surface: { $value: '{semantic.color.bg}' } } } } } };
const MODE = { Mode: { dimension: 'color-scheme', map: { Light: 'light', Dark: 'dark' } } };
const COLOR_SCHEME = { 'color-scheme': { values: ['light', 'dark'], default: 'light' } };

async function withExport({ sets = BASE_SETS, order = Object.keys(sets), themes = THEMES, themesConfig = MODE, modes = COLOR_SCHEME, metadata = true, setTiers = { core: 'option', light: 'semantic', dark: 'semantic', compact: 'option' } } = {}, assert) {
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-tokens-studio-'));
  try {
    mkdirSync(join(dir, 'export'));
    for (const [name, data] of Object.entries(sets)) writeFileSync(join(dir, 'export', `${name}.json`), JSON.stringify(data, null, 2));
    if (metadata) writeFileSync(join(dir, 'export', '$metadata.json'), JSON.stringify({ tokenSetOrder: order }));
    writeFileSync(join(dir, 'export', '$themes.json'), JSON.stringify(themes));
    writeFileSync(join(dir, 'bindings.tokens.json'), JSON.stringify(BINDINGS));
    const layer = { tokensStudio: 'export', ...(themesConfig ? { themes: themesConfig } : {}), sets: setTiers };
    writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({ name: 'ts-case', tokens: [layer, 'bindings.tokens.json'], modes, targets: {} }));
    await assert(await compile({ cwd: dir, targets: [], emit: false, loadExporter }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The base case compiles clean, so every failure below is its one change.
await withExport({}, (r) => expect('base case: no error', r.diagnostics.errors.length === 0, r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; ')));

// Two groups, two dimensions: dark + compact gets dark colors and compact spacing.
const DENSITY_THEMES = [
  ...THEMES,
  { id: 'c', name: 'Comfortable', group: 'Density', selectedTokenSets: { compact: 'disabled' } },
  { id: 'k', name: 'Compact', group: 'Density', selectedTokenSets: { compact: 'enabled' } },
];
const DENSITY_CONFIG = { ...MODE, Density: { dimension: 'density', map: { Comfortable: 'comfortable', Compact: 'compact' } } };
const DENSITY_MODES = { ...COLOR_SCHEME, density: { values: ['comfortable', 'compact'], default: 'comfortable' } };
const compact = { space: { base: t('spacing', '2') } };
await withExport({ sets: { ...BASE_SETS, compact }, themes: DENSITY_THEMES, themesConfig: DENSITY_CONFIG, modes: DENSITY_MODES }, (r) => {
  expect('two groups: no error', r.diagnostics.errors.length === 0, r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; '));
  const combo = r.normalized?.modes['dark+compact'];
  expect('two groups: dark+compact has the dark background', combo?.get('semantic.color.bg')?.provenance.target === 'option.color.ink', JSON.stringify(combo?.get('semantic.color.bg')?.provenance));
  expect('two groups: dark+compact has the compact spacing', combo?.get('option.space.base')?.value === '2px', String(combo?.get('option.space.base')?.value));
  expect('two groups: light+comfortable keeps the base spacing', r.normalized?.modes['light+comfortable']?.get('option.space.base')?.value === '4px');
});
// The same, but the compact set also sets a color and comes before the
// color sets: Tokens Studio gives dark+compact the dark color (later set),
// one override per dimension would give the compact one. Refused.
await withExport(
  {
    sets: { ...BASE_SETS, compact: { ...compact, color: { bg: t('color', '#eeeeee') } } },
    order: ['core', 'compact', 'light', 'dark'],
    themes: DENSITY_THEMES,
    themesConfig: DENSITY_CONFIG,
    modes: DENSITY_MODES,
    setTiers: { core: 'option', compact: 'semantic', light: 'semantic', dark: 'semantic' },
  },
  (r) => expect('interacting groups: TST1008', codes(r).includes('TST1008'), codes(r).join(', ')),
);
// A group compiled with one theme only.
await withExport({ themesConfig: { Mode: { fixed: 'Dark' } } }, (r) => {
  expect('fixed group: no error', r.diagnostics.errors.length === 0, r.diagnostics.errors.map((d) => `${d.code} ${d.message}`).join('; '));
  expect('fixed group: the fixed theme is the base', r.normalized?.modes.light?.get('semantic.color.bg')?.provenance.target === 'option.color.ink');
});

const FAILING = {
  TST1003: { metadata: false },
  TST1004: { themesConfig: null },
  TST1006: { sets: { ...BASE_SETS, core: { ...BASE_SETS.core, space: { base: t('spacing', '4'), md: t('spacing', 'sqrt({space.base})') } } } },
  TST1007: { sets: { ...BASE_SETS, light: { color: { ...BASE_SETS.light.color, hover: { ...t('color', '{color.blue}'), $extensions: { 'studio.tokens': { modify: { type: 'darken', value: '0.2', space: 'lch' } } } } } } } },
  TST1008: { sets: { ...BASE_SETS, dark: { color: { ...BASE_SETS.dark.color, glow: t('color', '{color.blue}') } } } },
  TST1009: { sets: { ...BASE_SETS, core: { ...BASE_SETS.core, weight: t('fontWeights', 'Bold Italic') } } },
  TST1109: { themesConfig: { Mode: { dimension: 'color-scheme', map: { Light: 'light', Dark: 'dim' } } } },
};
for (const [code, setup] of Object.entries(FAILING)) {
  await withExport(setup, (r) => expect(`failing export for ${code} raises it`, codes(r).includes(code), codes(r).join(', ') || '(no diagnostic)'));
}
// TST1009 also covers a token a non-default theme leaves out (carried over, a warning).
await withExport({ sets: { ...BASE_SETS, dark: { color: { bg: BASE_SETS.dark.color.bg, fg: BASE_SETS.dark.color.fg } } } }, (r) => {
  expect('a token missing from the dark theme is TST1009, not an error', codes(r).includes('TST1009') && r.diagnostics.errors.length === 0, codes(r).join(', '));
});
// TST1005: the legacy format, with `.value` references.
await withExport({ sets: { ...BASE_SETS, core: { color: { white: { value: '#ffffff', type: 'color' }, ink: { value: '#111827', type: 'color' }, blue: { value: '{color.white.value}', type: 'color' } }, space: { base: { value: '4', type: 'spacing' } } } } }, (r) => {
  expect('a legacy set is TST1005 and still compiles', codes(r).includes('TST1005') && r.diagnostics.errors.length === 0, codes(r).join(', '));
  expect('a .value reference resolves', r.normalized?.modes.light?.get('option.color.blue')?.provenance.target === 'option.color.white');
});
// A plain glob never reads math: a DTCG string with braces stays as authored.
{
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-tokens-studio-plain-'));
  try {
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify({ semantic: { color: { primary: { solid: t('color', '#2563eb') } } }, option: { size: { calc: t('dimension', 'calc(4px * 2)') } } }));
    writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({ name: 'plain', tokens: ['tokens.json'], targets: {} }));
    const r = await compile({ cwd: dir, targets: [], emit: false, loadExporter });
    expect('plain DTCG calc() is not evaluated', r.normalized?.modes.light?.get('option.size.calc')?.value === 'calc(4px * 2)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- 6: the evaluator ----------
const values = new Map([['a', '4px'], ['b', 1.5], ['r', '0.5rem'], ['c', { l: 0, c: 0, h: 0, alpha: 1 }]]);
const EVAL = [
  ['{a} * 2', 'dimension', '8px'],
  ['{a} * -1', 'dimension', '-4px'],
  ['({a} + 2) / 3', 'dimension', '2px'],
  ['roundTo(10 / 3, 2)', 'dimension', '3.33px'],
  ['min({a}, 3) max(1, 2)', 'dimension', '3px 2px'],
  ['{r} * 2', 'dimension', '1rem'],
  ['{b} * 1.2', 'number', 1.8],
  ['0.1 + 0.2', 'number', 0.3],
  ['10 / 4', 'fontWeight', 2.5],
];
for (const [text, type, want] of EVAL) {
  let got;
  try { got = evaluateExpression(text, type, values); } catch (e) { got = `throws ${e.message}`; }
  expect(`evaluate "${text}" as ${type} → ${JSON.stringify(want)}`, got === want, JSON.stringify(got));
}
const color = evaluateExpression('rgba({c}, 50%)', 'color', values);
expect('rgba({ref}, 50%) keeps the color and sets alpha 0.5', color.alpha === 0.5 && color.l === 0);
const hex = evaluateExpression('rgba(#ffffff, 0.25)', 'color', values);
expect('rgba(#hex, a) parses the hex', hex.alpha === 0.25 && hex.l > 0.99);
for (const [text, type, why] of [
  ['{a} + {r}', 'dimension', 'mixed units'],
  ['pow(2, 3)', 'dimension', 'unsupported function'],
  ['{a} / 0', 'dimension', 'division by zero'],
  ['{c} * 2', 'dimension', 'a color in math'],
  ['{a} * 2', 'color', 'math on a color'],
]) {
  let threw = false;
  try { evaluateExpression(text, type, values); } catch (e) { threw = e instanceof ExpressionError; }
  expect(`evaluate "${text}" fails (${why})`, threw);
}

if (errors.length) {
  console.error(`✖ check-tokens-studio: ${errors.length} failure(s)\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✔ tokens-studio: folder, single-file and legacy exports compile on all ${results.folder.results.length} target instances byte-identical to their plain DTCG twin (${compared} files); explain names set files per mode and shows expressions; two theme groups lower to two dimensions and interacting groups are refused; ${Object.keys(FAILING).length} failing exports raise their codes; ${EVAL.length + 7} evaluator cases`);
