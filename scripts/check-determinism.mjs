#!/usr/bin/env node
/**
 * Determinism gate (docs/plan/catalog-revision.md T5): builds each example
 * twice into isolated temp directories and byte-diffs the results. Identical
 * inputs must produce byte-identical output — no timestamps, no randomness,
 * no environment leakage. The mode-dimensions fixture (color-scheme ×
 * contrast × motion × brand, #49 and #50) is built too: it is the one project
 * where exporters emit combo blocks, per-brand files and per-combo themes.
 * Run: node scripts/check-determinism.mjs.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const examples = ['acme', 'cathode', 'govuk', 'carbon'];
const projects = [
  ...examples.map((name) => [name, join(root, 'examples', name)]),
  ['mode-dimensions fixture', join(root, 'packages/core/test-fixtures/mode-dimensions')],
];

let failed = false;
for (const [name, exampleDir] of projects) {
  const distDir = join(exampleDir, 'dist');
  const snapshots = [];
  for (let i = 0; i < 2; i++) {
    execSync(`node "${cli}" build --cwd "${exampleDir}"`, { stdio: 'pipe' });
    const snap = mkdtempSync(join(tmpdir(), `transtyle-determinism-${name.replace(/\W+/g, '-')}-`));
    if (existsSync(distDir)) cpSync(distDir, snap, { recursive: true });
    snapshots.push(snap);
  }
  try {
    execSync(`diff -rq "${snapshots[0]}" "${snapshots[1]}"`, { stdio: 'pipe' });
    console.log(`✔ ${name}: two builds byte-identical`);
  } catch (e) {
    failed = true;
    console.error(`✖ ${name}: builds differ —\n${e.stdout?.toString() ?? e.message}`);
  } finally {
    for (const s of snapshots) rmSync(s, { recursive: true, force: true });
  }
}

if (failed) {
  console.error('\n✖ check-determinism failed — see diffs above');
  process.exit(1);
}
console.log('\n✔ check-determinism: all examples and the mode-dimensions fixture build byte-identically across two runs');
