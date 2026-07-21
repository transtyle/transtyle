#!/usr/bin/env node
/**
 * Golden-file test for the CLI's project-scaffolding commands
 * (docs/plan/catalog-revision.md T6). Runs init -> add -> build -> explain
 * in a throwaway temp directory and asserts exit codes + key output
 * substrings. Not a full test suite — a smoke test that the happy path and
 * the documented error cases (existing config, unknown target, duplicate
 * target, unknown slot) behave as specced.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const dir = mkdtempSync(join(tmpdir(), 'transtyle-check-cli-'));

let failures = 0;
function run(args) {
  const r = spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? ''), stdout: r.stdout ?? '' };
}
function expect(label, cond, detail) {
  if (!cond) { console.error(`✖ ${label}${detail ? ` — ${detail}` : ''}`); failures++; }
  else console.log(`✔ ${label}`);
}

try {
  let r = run(['init', 'checkcli-ds', '--cwd', dir]);
  expect('init: exit 0', r.code === 0, `exit ${r.code}: ${r.out}`);
  expect('init: config created', existsSync(join(dir, 'transtyle.config.json')));
  expect('init: tokens created', existsSync(join(dir, 'tokens/brand.tokens.json')));

  r = run(['init', '--cwd', dir]);
  expect('init: refuses when config exists (exit 2)', r.code === 2, `exit ${r.code}`);

  r = run(['build', '--cwd', dir]);
  expect('build: scaffold builds clean (exit 0)', r.code === 0, r.out);
  expect('build: css-variables emitted', r.out.includes('dist/css-variables'));

  r = run(['add', 'shadcn', '--cwd', dir]);
  expect('add shadcn: exit 0', r.code === 0, r.out);

  r = run(['add', 'not-a-real-target', '--cwd', dir]);
  expect('add: unknown target refused (exit 2)', r.code === 2);
  expect('add: unknown target lists valid ones', r.out.includes('Valid targets:'));

  r = run(['add', 'shadcn', '--cwd', dir]);
  expect('add: duplicate target refused (exit 2)', r.code === 2);

  r = run(['build', 'shadcn', '--cwd', dir]);
  expect('build shadcn: exit 0', r.code === 0, r.out);
  expect('build shadcn: artifact written', existsSync(join(dir, 'dist/shadcn/globals.transtyle.css')));

  r = run(['explain', 'primary.solid', '--cwd', dir]);
  expect('explain: exit 0', r.code === 0, r.out);
  expect('explain: shows the resolved value', r.out.includes('semantic.color.primary.solid = oklch'));
  expect('explain: shows provenance', r.out.includes('aliased →'));

  r = run(['explain', 'primary.doesnotexist', '--cwd', dir]);
  expect('explain: unknown slot refused (exit 2)', r.code === 2);
  expect('explain: unknown slot suggests alternatives', r.out.includes('Closest matches:'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ---------- T10: DTCG validation diagnostics, --json ----------
{
  const fixture = join(root, 'packages/core/test-fixtures/dtcg-validation');
  const r = run(['check', '--cwd', fixture, '--json']);
  expect('check --json: fails on the fixture\'s deliberate errors (exit 1)', r.code === 1, `exit ${r.code}`);
  for (const code of ['TST1305', 'TST1302', 'TST1306', 'TST1304', 'TST1105']) {
    expect(`check --json: reports ${code}`, r.out.includes(`"${code}"`), r.out);
  }
  expect('check --json: prints a parseable JSON report', (() => {
    try { return Array.isArray(JSON.parse(r.stdout).diagnostics); } catch { return false; }
  })());
}

if (failures) {
  console.error(`\n✖ check-cli: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✔ check-cli: init/add/build/explain golden path and error cases all pass');
