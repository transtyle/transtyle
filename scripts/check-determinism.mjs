#!/usr/bin/env node
/**
 * Determinism gate (docs/plan/catalog-revision.md T5): builds each example
 * twice into isolated temp directories and byte-diffs the results. Identical
 * inputs must produce byte-identical output — no timestamps, no randomness,
 * no environment leakage. Run: node scripts/check-determinism.mjs.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/src/main.js');
const examples = ['acme', 'cathode', 'govuk', 'carbon'];

let failed = false;
for (const name of examples) {
  const exampleDir = join(root, 'examples', name);
  const distDir = join(exampleDir, 'dist');
  const snapshots = [];
  for (let i = 0; i < 2; i++) {
    execSync(`node "${cli}" build --cwd "${exampleDir}"`, { stdio: 'pipe' });
    const snap = mkdtempSync(join(tmpdir(), `transtyle-determinism-${name}-`));
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
console.log('\n✔ check-determinism: all examples build byte-identically across two runs');
