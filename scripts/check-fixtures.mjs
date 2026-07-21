#!/usr/bin/env node
/**
 * Ground-truth fixture check (docs/plan/catalog-revision.md T5). Diffs a
 * fresh `dist/` build of Acme against the Phase 0 acceptance fixtures in
 * examples/acme/expected/ — key by key, value-normalized (whitespace,
 * comments, leading-zero decimals) so cosmetic formatting differences
 * (".25rem" vs "0.25rem") don't trip a real-value regression. This is the
 * permanent, scripted form of the manual acceptance diffing done when the
 * Bootstrap/Storybook exporters shipped and when the catalog was revised.
 *
 * Run: node scripts/check-fixtures.mjs (also: npm run check:fixtures).
 * Rebuilds Acme first so the comparison is always against current output.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const acme = join(root, 'examples/acme');

execSync('npx transtyle build --cwd examples/acme', { cwd: root, stdio: 'pipe' });

const norm = (v) => v.replace(/\s+/g, ' ').replace(/;$/, '').replace(/(^|[\s(,])0\./g, '$1.').trim().toLowerCase();

function parseScssLike(text) {
  const src = text.split('\n').map((l) => l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')).join('\n');
  const out = new Map();
  for (const m of src.matchAll(/\$([\w-]+):\s*\(([^)]*)\)/g)) {
    for (const e of m[2].matchAll(/"([\w-]+)":\s*([^,\n]+)/g)) out.set(`$${m[1]}.${e[1]}`, norm(e[2]));
    for (const e of m[2].matchAll(/(?<![\w"])(\d+):\s*([^,\n]+)/g)) out.set(`$${m[1]}.${e[1]}`, norm(e[2]));
  }
  for (const m of src.matchAll(/^\$([\w-]+):\s*(?!\()([^;\n]+);?/gm)) out.set(`$${m[1]}`, norm(m[2]));
  let block = 'light';
  for (const line of src.split('\n')) {
    if (/data-bs-theme="dark"/.test(line)) block = 'dark';
    for (const mm of line.matchAll(/(--bs-[\w-]+):\s*([^;]+);/g)) out.set(`${block}:${mm[1]}`, norm(mm[2]));
  }
  return out;
}

function parseThemeVars(text) {
  const out = new Map();
  let base = null;
  for (const line of text.split('\n')) {
    const b = /export const (\w+) = create\(/.exec(line);
    if (b) base = b[1];
    const m = /^\s*(\w+):\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?))\s*,/.exec(line.replace(/\/\/.*$/, ''));
    if (m && base) out.set(`${base}.${m[1]}`, m[2] ?? m[3]);
  }
  return out;
}

let mismatches = 0;
function diffMaps(label, expected, got) {
  console.log(`\n=== ${label} (${expected.size} expected keys)`);
  for (const [k, v] of expected) {
    if (!got.has(k)) { console.log(`  MISSING ${k} (expected ${v})`); mismatches++; }
    else if (got.get(k) !== v) { console.log(`  DIFF ${k}: expected ${v} · got ${got.get(k)}`); mismatches++; }
  }
}

for (const file of ['_variables.transtyle.scss', '_maps.transtyle.scss', 'bootstrap-theme.css']) {
  const expected = parseScssLike(readFileSync(join(acme, 'expected/bootstrap', file), 'utf8'));
  const got = parseScssLike(readFileSync(join(acme, 'dist/bootstrap', file), 'utf8'));
  diffMaps(`bootstrap/${file}`, expected, got);
}

const expectedTheme = parseThemeVars(readFileSync(join(acme, 'expected/storybook/theme.transtyle.ts'), 'utf8'));
const gotTheme = parseThemeVars(readFileSync(join(acme, 'dist/storybook/theme.transtyle.ts'), 'utf8'));
diffMaps('storybook/theme.transtyle.ts', expectedTheme, gotTheme);

// preview/manager probes: substrings that must survive in the live output
const previewProbes = [
  "value: '#ffffff'", "value: '#080b0f'", "colorScheme: 'light'",
  "classList.toggle('dark'", "data-theme", "acme-design-system-${scheme}",
  "shadcn/globals.transtyle.css", "daisyui/daisyui.transtyle.css",
];
const preview = readFileSync(join(acme, 'dist/storybook/preview.transtyle.ts'), 'utf8');
console.log('\n=== storybook/preview.transtyle.ts (probes)');
for (const probe of previewProbes) {
  if (!preview.includes(probe)) { console.log(`  MISSING probe: ${probe}`); mismatches++; }
}
const manager = readFileSync(join(acme, 'dist/storybook/manager.transtyle.ts'), 'utf8');
console.log('\n=== storybook/manager.transtyle.ts (probe)');
if (!manager.includes('addons.setConfig({ theme: light })')) { console.log('  MISSING: native-mode chrome wiring'); mismatches++; }

if (mismatches) {
  console.error(`\n✖ check-fixtures: ${mismatches} mismatch(es) against the Phase 0 acceptance fixtures`);
  process.exit(1);
}
console.log('\n✔ check-fixtures: dist/ matches every value in examples/acme/expected/ (Bootstrap + Storybook)');
