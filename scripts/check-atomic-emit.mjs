#!/usr/bin/env node
/**
 * Atomic EMIT gate (docs/architecture/pipeline.md, section 5; issue #90).
 *
 * A failed build must never leave a half-written output. Runs core's `compile()`
 * with stub exporters in a throwaway project and asserts, for each failure
 * point, that every output directory is byte-for-byte what it was before the
 * build and that no staging directory is left behind:
 *
 *   1. an exporter throws on the second target (after the first one emitted;
 *      core records TST3001 and still runs the third);
 *   2. a later target is not configured (error-level diagnostic after the first
 *      target already produced files);
 *   3. the SWAP fails midway (a later target's output path is a regular file),
 *      after earlier targets were already renamed into place: replaced files
 *      come back, new files and new directories are removed;
 *   4. a clean build still writes everything, replaces changed files, and leaves
 *      files it did not produce untouched;
 *   5. every report.json of one build lists the same diagnostics and
 *      suppressions, whatever the target order, including a warning an
 *      exporter raises for a later target, which `check.suppress` can silence
 *      (issue #186: each report was serialised inside the target loop, so an
 *      earlier target's report missed it); `--dry-run`'s planned byte counts
 *      are those of the reports a real build writes.
 *
 * Run: node scripts/check-atomic-emit.mjs (also: npm run check:atomic-emit; in check:all).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@transtyle/core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-atomic-'));
let failures = 0;
function expect(label, cond, detail) {
  if (!cond) { console.error(`✖ ${label}${detail ? ` — ${detail}` : ''}`); failures++; }
  else console.log(`✔ ${label}`);
}

/** Every file and directory under `dir`, with contents, as one comparable string. */
function snapshot() {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const rel = relative(dir, p);
      if (rel === 'tokens' || rel === 'transtyle.config.json') continue;
      if (statSync(p).isDirectory()) { out.push(`${rel}/`); walk(p); }
      else out.push(`${rel}\0${readFileSync(p, 'utf8')}`);
    }
  };
  walk(dir);
  return out.join('\n');
}
const leftovers = () => readdirSync(dir).filter((n) => n.endsWith('.transtyle-tmp') || n.endsWith('.transtyle-bak'));

let version = 'v1';
const exporters = {
  alpha: { emit: () => ({ files: [{ path: 'a.txt', contents: `alpha ${version}\n` }, { path: 'nested/b.txt', contents: `nested ${version}\n` }], coverage: [] }) },
  beta: { emit: () => ({ files: [{ path: 'c.txt', contents: `beta ${version}\n` }], coverage: [] }) },
  gamma: { emit: () => ({ files: [{ path: 'd.txt', contents: `gamma ${version}\n` }], coverage: [] }) },
  boom: { emit: () => { throw new Error('exporter exploded'); } },
  quiet: { emit: () => ({ files: [{ path: 'q.txt', contents: 'quiet\n' }], coverage: [] }) },
  loud: { emit: () => ({ files: [{ path: 'l.txt', contents: 'loud\n' }], coverage: [], diagnostics: [{ severity: 'warning', code: 'TST9999', message: 'a later target has something to say' }] }) },
};
const loadExporter = async (name) => exporters[name];

function configure(targets, check) {
  const cfgPath = join(dir, 'transtyle.config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.targets = targets;
  if (check) cfg.check = check;
  else delete cfg.check;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}
const build = (targets, options = {}) => compile({ cwd: dir, targets, loadExporter, knownExporters: Object.keys(exporters), ...options });
const reportOf = (target) => JSON.parse(readFileSync(join(dir, `out/${target}/report.json`), 'utf8'));
const codes = (list) => list.map((d) => d.code).join(',');

try {
  execFileSync('node', [cli, 'init', 'atomic-check', '--cwd', dir], { stdio: 'pipe' });

  // 4a. clean first build
  configure({ alpha: { output: 'out/alpha' }, beta: { output: 'out/beta' } });
  let r = await build();
  expect('clean build: no errors', r.diagnostics.errors.length === 0);
  expect('clean build: files written', readFileSync(join(dir, 'out/alpha/nested/b.txt'), 'utf8') === 'nested v1\n' && existsSync(join(dir, 'out/beta/report.json')));
  expect('clean build: no staging directories left', leftovers().length === 0, leftovers().join(', '));

  // An orphan a previous build (or a human) left in a shared output directory.
  writeFileSync(join(dir, 'out/alpha/orphan.txt'), 'keep me\n');
  const before = snapshot();
  version = 'v2';

  // 1. exporter throws on the second target
  configure({ alpha: { output: 'out/alpha' }, boom: { output: 'out/boom' }, beta: { output: 'out/beta' } });
  r = await build();
  expect('exporter throws on 2nd target: TST3001 raised, 3rd target still ran', r.diagnostics.errors.some((e) => e.code === 'TST3001') && r.results.length === 3 && r.results[2].emitted.length > 0);
  expect('exporter throws on 2nd target: results list no written files', r.results.every((x) => x.files.length === 0));
  expect('exporter throws on 2nd target: outputs untouched', snapshot().replace(/out\/boom\/\n?/g, '') === before.replace(/out\/boom\/\n?/g, '') && !existsSync(join(dir, 'out/boom')));
  expect('exporter throws on 2nd target: no staging directories left', leftovers().length === 0, leftovers().join(', '));

  // 2. a later target is not configured -> error diagnostic, nothing written
  configure({ alpha: { output: 'out/alpha' }, beta: { output: 'out/beta' } });
  r = await build(['alpha', 'nope']);
  expect('unknown 2nd target: TST1301 raised', r.diagnostics.errors.some((e) => e.code === 'TST1301'));
  expect('unknown 2nd target: outputs untouched', snapshot() === before);
  expect('unknown 2nd target: results list no written files', r.results.every((x) => x.files.length === 0));
  expect('unknown 2nd target: no staging directories left', leftovers().length === 0);

  // 3. SWAP fails midway: gamma's output path is a regular file, so after alpha
  // (replaced files) and beta (new directory) are in place, gamma cannot be.
  mkdirSync(join(dir, 'out'), { recursive: true });
  writeFileSync(join(dir, 'out/blocker'), 'i am a file\n');
  const beforeSwap = snapshot();
  configure({ alpha: { output: 'out/alpha' }, fresh: { exporter: 'beta', output: 'out/fresh/deep' }, gamma: { output: 'out/blocker' } });
  let threw = false;
  try { await build(); } catch (e) { threw = true; }
  expect('swap fails midway: build rejects', threw);
  expect('swap fails midway: replaced files restored, new ones and new directories removed', snapshot() === beforeSwap, 'snapshot differs');
  expect('swap fails midway: orphan untouched', readFileSync(join(dir, 'out/alpha/orphan.txt'), 'utf8') === 'keep me\n');
  expect('swap fails midway: no staging directories left', leftovers().length === 0, leftovers().join(', '));
  rmSync(join(dir, 'out/blocker'));

  // 4b. clean rebuild with changed content
  configure({ alpha: { output: 'out/alpha' }, beta: { output: 'out/beta' } });
  r = await build();
  expect('rebuild: changed files replaced', readFileSync(join(dir, 'out/alpha/a.txt'), 'utf8') === 'alpha v2\n' && readFileSync(join(dir, 'out/beta/c.txt'), 'utf8') === 'beta v2\n');
  expect('rebuild: file this build did not produce is untouched', readFileSync(join(dir, 'out/alpha/orphan.txt'), 'utf8') === 'keep me\n');
  expect('rebuild: results list the written files', r.results[0].files.includes('out/alpha/a.txt') && r.results[0].files.includes('out/alpha/report.json'));
  expect('rebuild: no staging directories left', leftovers().length === 0);

  // 5. every report.json of one build agrees, a later exporter's warning included
  configure({ quiet: { output: 'out/quiet' }, loud: { output: 'out/loud' } });
  const reports = {};
  for (const order of [['quiet', 'loud'], ['loud', 'quiet']]) {
    r = await build(order);
    const [first, second] = order.map(reportOf);
    reports[order.join('>')] = first;
    expect(`reports agree (${order.join(' then ')}): no errors`, r.diagnostics.errors.length === 0, codes(r.diagnostics.errors));
    expect(
      `reports agree (${order.join(' then ')}): both list the later exporter's TST9999 and the same diagnostics`,
      first.diagnostics.some((d) => d.code === 'TST9999' && d.target === 'loud') && JSON.stringify(first.diagnostics) === JSON.stringify(second.diagnostics) && JSON.stringify(first.suppressed) === JSON.stringify(second.suppressed),
      `${order[0]}: ${codes(first.diagnostics)} / ${order[1]}: ${codes(second.diagnostics)}`,
    );
  }
  expect('reports agree: target order does not change the list', JSON.stringify(reports['quiet>loud'].diagnostics) === JSON.stringify(reports['loud>quiet'].diagnostics));

  configure({ quiet: { output: 'out/quiet' }, loud: { output: 'out/loud' } }, { suppress: [{ code: 'TST9999', reason: 'known, checked by hand' }] });
  r = await build(['quiet', 'loud']);
  const [quiet, loud] = ['quiet', 'loud'].map(reportOf);
  expect(
    'an exporter diagnostic can be suppressed: gone from diagnostics, listed in suppressed in every report, no TST1012',
    !r.diagnostics.items.some((d) => d.code === 'TST9999' || d.code === 'TST1012') &&
      [quiet, loud].every((x) => !x.diagnostics.some((d) => d.code === 'TST9999') && x.suppressed.some((d) => d.code === 'TST9999' && d.reason === 'known, checked by hand')),
    `diagnostics: ${codes(r.diagnostics.items)}; quiet suppressed: ${codes(quiet.suppressed)}`,
  );

  const sizes = Object.fromEntries(['quiet', 'loud'].map((t) => [`out/${t}/report.json`, statSync(join(dir, `out/${t}/report.json`)).size]));
  const before5 = snapshot();
  r = await build(['quiet', 'loud'], { dryRun: true });
  const planned = r.results.flatMap((x) => x.planned).filter((f) => f.path.endsWith('report.json'));
  expect('dry run: plans both report.json files with the bytes a real build writes, and writes nothing', planned.length === 2 && planned.every((f) => sizes[f.path] === f.bytes) && snapshot() === before5, JSON.stringify(planned));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} atomic-emit check(s) failed`);
  process.exit(1);
}
console.log('\nAll atomic-emit checks passed');
