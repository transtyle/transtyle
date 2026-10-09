#!/usr/bin/env node
/**
 * Acceptance check for the config-level rem base (`units.remBase`, #86).
 * Compiles a small design system in-process, with the real ECharts and
 * Storybook exporters, and asserts:
 *  (a) a `10px` base turns 0.5rem into 5 in the ECharts theme and the Storybook
 *      theme, and both coverage notes name the base;
 *  (b) leaving the key out and writing the default `"16px"` give byte-identical
 *      output, with 8 for 0.5rem (today's behavior);
 *  (c) Storybook's own `options.remBase` still wins over the config-level one;
 *  (d) a base that is not a positive px length ("abc", "0px", "100%", 16) is a
 *      TST1010 error.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@transtyle/core';
import echarts from '@transtyle/exporter-echarts';
import storybook from '@transtyle/exporter-storybook';

const exporters = { echarts, storybook };
const loadExporter = async (name) => exporters[name];
const errors = [];
const expect = (ok, msg) => { if (!ok) errors.push(msg); };

async function build(units, storybookOptions) {
  const dir = mkdtempSync(join(tmpdir(), 'transtyle-rem-base-'));
  try {
    mkdirSync(join(dir, 'tokens'));
    writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify({
      semantic: {
        color: {
          primary: { solid: { $type: 'color', $value: '#0d6efd' } },
          surface: { $type: 'color', $value: '#ffffff' },
          text: { base: { $type: 'color', $value: '#212529' } },
        },
        radius: { md: { $type: 'dimension', $value: '0.5rem' } },
      },
    }));
    writeFileSync(join(dir, 'transtyle.config.json'), JSON.stringify({
      name: 'rem-base',
      tokens: ['tokens/*.tokens.json'],
      modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
      ...(units !== undefined && { units }),
      targets: {
        echarts: {},
        storybook: storybookOptions ? { options: storybookOptions } : {},
      },
    }));
    const r = await compile({ cwd: dir, emit: false, loadExporter });
    const files = Object.fromEntries(r.results.flatMap((t) => t.emitted.map((f) => [`${t.target}/${f.path}`, f.contents])));
    return { r, files, coverage: r.results.flatMap((t) => t.coverage), errors: r.diagnostics.errors };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const echartsRadius = (files) => JSON.parse(files['echarts/theme.rem-base-light.json']).tooltip.borderRadius;
const storybookRadius = (files) => /appBorderRadius:\s*(\d+)/.exec(files['storybook/theme.transtyle.ts'])?.[1];
const notes = (coverage) => coverage.filter((c) => c.class === 'approximated').map((c) => c.note).join(' | ');

const ten = await build({ remBase: '10px' });
expect(!ten.errors.length, `10px base: compile errors: ${ten.errors.map((e) => e.message).join('; ')}`);
expect(echartsRadius(ten.files) === 5, `10px base: ECharts tooltip.borderRadius should be 5, got ${echartsRadius(ten.files)}`);
expect(storybookRadius(ten.files) === '5', `10px base: Storybook appBorderRadius should be 5, got ${storybookRadius(ten.files)}`);
expect(/base 10\b/.test(notes(ten.coverage)) && /remBase 10\b/.test(notes(ten.coverage)), `10px base: coverage notes should name base 10, got: ${notes(ten.coverage)}`);

const none = await build(undefined);
const sixteen = await build({ remBase: '16px' });
expect(echartsRadius(none.files) === 8 && storybookRadius(none.files) === '8', 'default base: 0.5rem should be 8px in both targets');
expect(JSON.stringify(none.files) === JSON.stringify(sixteen.files), 'omitting units and writing "16px" must emit identical files');
expect(JSON.stringify(none.coverage) === JSON.stringify(sixteen.coverage), 'omitting units and writing "16px" must report identical coverage');

const override = await build({ remBase: '10px' }, { remBase: 20 });
expect(storybookRadius(override.files) === '10', `options.remBase 20 should win over units.remBase: expected 10, got ${storybookRadius(override.files)}`);
expect(echartsRadius(override.files) === 5, 'options.remBase must not leak into the ECharts target');

for (const bad of ['abc', '0px', '0.0px', '100%', '1rem', '-4px', 16]) {
  const r = await build({ remBase: bad });
  const e = r.errors.find((d) => d.code === 'TST1010' && d.message.includes('units.remBase'));
  expect(e, `remBase ${JSON.stringify(bad)} should be a TST1010 error naming units.remBase, got: ${r.errors.map((d) => d.code + ' ' + d.message).join('; ') || 'no error'}`);
}

if (errors.length) {
  console.error(`✖ check-rem-base failed — ${errors.length} issue(s):\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✔ check-rem-base: a 10px base gives 5 for 0.5rem in ECharts and Storybook with the base named in both notes; omitting the key equals "16px" byte for byte; options.remBase still overrides; "abc", "0px", "100%", "1rem" and a bare number are TST1010');
