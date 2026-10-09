#!/usr/bin/env node
/**
 * Gamut honesty (#171): a colour that formatHex had to clamp into sRGB is not
 * the colour the token says, so every hex/HSL writer must say so on the row of
 * each variable it wrote from it.
 *
 * Acme with an authored out-of-gamut primary (`oklch(0.7 0.3 145)`) must give
 * at least one `approximated` row carrying the gamut note in Bootstrap,
 * Storybook, ECharts, Radix and shadcn (tailwind-v3, HSL); and ECharts must
 * name the clamp on the variable itself, never on an aggregate `(gamut)` row.
 *
 * Run: node scripts/check-gamut-rows.mjs (also: npm run check:gamut-rows).
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localExporter, root } from './lib/compile-examples.mjs';

const dir = mkdtempSync(join(tmpdir(), 'transtyle-gamut-'));
try {
  cpSync(join(root, 'examples/acme/tokens'), join(dir, 'tokens'), { recursive: true });
  const config = JSON.parse(readFileSync(join(root, 'examples/acme/transtyle.config.json'), 'utf8'));
  writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify(config));
  const file = join(dir, 'tokens/semantic.tokens.json');
  const tokens = JSON.parse(readFileSync(file, 'utf8'));
  tokens.semantic.color.primary.solid.$value = 'oklch(0.7 0.3 145)';
  writeFileSync(file, JSON.stringify(tokens));

  const { compile } = await import(pathToFileURL(join(root, 'packages/core/src/index.js')).href);
  const result = await compile({ cwd: dir, emit: false, loadExporter: localExporter });
  const errors = result.diagnostics?.errors ?? [];
  if (errors.length) throw new Error(errors.map((d) => `${d.code} ${d.message}`).join('\n'));

  const names = Object.keys(config.targets);
  const rows = (name) => result.results[names.indexOf(name)].coverage ?? [];
  const failures = [];
  for (const name of ['bootstrap', 'storybook', 'echarts', 'radix', 'shadcn-v3']) {
    const gamut = rows(name).filter((c) => c.class === 'approximated' && /gamut/i.test(c.note ?? ''));
    if (gamut.length === 0) failures.push(`${name}: no approximated row carries the gamut note`);
  }
  if (rows('echarts').some((c) => c.variable === '(gamut)')) {
    failures.push('echarts: the clamp is reported on an aggregate (gamut) row, not per variable');
  }
  if (failures.length) {
    console.error('✖ gamut rows:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('✔ gamut rows: an out-of-gamut primary is approximated, per variable, in all five hex/HSL writers');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
