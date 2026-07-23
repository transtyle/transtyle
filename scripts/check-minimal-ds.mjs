#!/usr/bin/env node
/**
 * AL5 guard: every exporter must survive a *minimal but valid* design system.
 *
 * Why this exists: the AL5 diagnostics sweep started by using the tool wrongly,
 * and the worst failure turned out to be a case where the user does nothing
 * wrong at all. A design system that authors only a brand color, a surface, and
 * a text color is legal — nothing requires a radius scale or a border color —
 * and `transtyle build bootstrap` answered it with a bare
 * `TypeError: Cannot read properties of undefined (reading 'value')`: no code,
 * no slot name, no hint, no output. Two more exporters silently wrote the
 * literal string `undefined` into their stylesheets.
 *
 * None of the existing checks could see it. `check:fixtures`, `check:coverage-bar`
 * and `check:bootstrap-surface` all run against the four examples, and every one
 * of those authors a complete token set — exactly the shape that hides this
 * class of bug.
 *
 * Asserts, for every registered exporter:
 *   1. it compiles without throwing;
 *   2. no emitted file contains a leaked `undefined` / `null` / `NaN` value;
 *   3. every emitted file has content;
 *   4. **coverage honesty**: no row classed `native`/`derived` names an IR slot
 *      that doesn't resolve.
 *
 * (4) came from the AL5 follow-up sweep, and found what (1)–(3) structurally
 * cannot: exporters that correctly *skip* an absent value — so nothing leaks and
 * nothing crashes — while still reporting it as covered. Storybook claimed five
 * ThemeVars its theme did not contain, because its class came from
 * `provenance.kind` and "no entry" fell through to `native`, the strongest claim
 * available. Silence plus a coverage claim is worse than either alone: the
 * report is the artifact users audit.
 *
 * Run: node scripts/check-minimal-ds.mjs   (npm run check:minimal-ds)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@transtyle/core';

const EXPORTERS = {
  shadcn: '@transtyle/exporter-shadcn',
  echarts: '@transtyle/exporter-echarts',
  daisyui: '@transtyle/exporter-daisyui',
  bootstrap: '@transtyle/exporter-bootstrap',
  storybook: '@transtyle/exporter-storybook',
  'css-variables': '@transtyle/exporter-css-variables',
  radix: '@transtyle/exporter-radix',
  primeng: '@transtyle/exporter-primeng',
};

/**
 * The floor, not a realistic design system: the brand color the engine cannot
 * invent, plus the two anchors every derivation reads. Deliberately no radius
 * scale, no spacing, no fonts, no dark-mode values — each omission is a real
 * authoring choice a first-time user makes, and each one used to break something.
 */
const MINIMAL_TOKENS = {
  semantic: {
    color: {
      primary: { solid: { $type: 'color', $value: '#3b5bdb' } },
      surface: { $type: 'color', $value: '#ffffff' },
      text: { base: { $type: 'color', $value: '#212529' } },
    },
  },
};

const dir = mkdtempSync(join(tmpdir(), 'transtyle-minimal-'));
mkdirSync(join(dir, 'tokens'));
writeFileSync(join(dir, 'tokens', 'base.tokens.json'), JSON.stringify(MINIMAL_TOKENS, null, 2));
writeFileSync(
  join(dir, 'transtyle.config.json'),
  JSON.stringify(
    {
      name: 'minimal',
      tokens: ['tokens/*.tokens.json'],
      modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
      derivation: { rules: 'standard@1' },
      targets: Object.fromEntries(
        Object.keys(EXPORTERS).map((n) => [n, { output: `dist/${n}` }]),
      ),
    },
    null,
    2,
  ),
);

const errors = [];
// `undefined` etc. as a whole word on the value side of a declaration. Matching
// the value side only keeps legitimate prose (a comment mentioning "undefined")
// out of it — the emitted files carry a lot of explanatory comments.
const LEAK = /(:|=>?)\s*(undefined|null|NaN)\b/;

let files = 0;
for (const [name, pkg] of Object.entries(EXPORTERS)) {
  const loadExporter = async () => (await import(pkg)).default;
  let result;
  try {
    result = await compile({ cwd: dir, targets: [name], emit: false, loadExporter });
  } catch (e) {
    errors.push(`${name}: threw instead of reporting — ${e.message}`);
    continue;
  }
  const hardErrors = result.diagnostics.errors;
  if (hardErrors.length) {
    errors.push(`${name}: a minimal design system produced errors — ${hardErrors.map((d) => `${d.code} ${d.message}`).join('; ')}`);
    continue;
  }
  const emitted = result.results.find((r) => r.target === name);
  if (!emitted) {
    errors.push(`${name}: produced no result`);
    continue;
  }
  for (const f of emitted.emitted ?? []) {
    files++;
    const contents = f.contents ?? '';
    if (!contents.trim()) errors.push(`${name}/${f.path}: emitted an empty file`);
    contents.split('\n').forEach((line, i) => {
      if (LEAK.test(line)) errors.push(`${name}/${f.path}:${i + 1} leaked a JS value into output: ${line.trim()}`);
    });
  }

  // 4. Coverage honesty. Only rows whose `slot` is a single, complete IR path
  //    are checkable — many rows legitimately carry a summary label instead
  //    (`semantic.{font.sans, type.size.md}`, `semantic.color.primary.1–8`, or a
  //    target's own namespace such as PrimeNG's `{primary.color}` runtime
  //    reference). Those are skipped rather than guessed at.
  const map = result.normalized.modes[result.normalized.defaultMode];
  for (const c of emitted.coverage ?? []) {
    if (!['native', 'derived'].includes(c.class)) continue;
    const slot = String(c.slot ?? '');
    if (!/^(semantic|component|option)\.[\w.-]+$/.test(slot)) continue;
    if (map.get(slot)?.value === undefined) {
      errors.push(`${name}: coverage row "${c.variable}" claims class ${c.class} from ${slot}, which does not resolve — absence is not coverage`);
    }
  }
}

rmSync(dir, { recursive: true, force: true });

if (errors.length) {
  console.error(`✘ minimal-ds check: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  - ' + e);
  console.error('\n  A design system may author only a brand color, a surface, and a text color.');
  console.error('  Exporters must read absent slots defensively and report them as coverage,');
  console.error('  never crash and never write a JS value into a stylesheet.');
  process.exit(1);
}
console.log(`✔ minimal-ds: all ${Object.keys(EXPORTERS).length} exporters compile a 3-token design system cleanly (${files} files, no leaked values)`);
