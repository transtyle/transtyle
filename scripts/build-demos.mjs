#!/usr/bin/env node
/**
 * Build the demo projects into one staging tree the website can serve.
 *
 * The 32 demos are already built on every pull request (ci.yml) to prove they
 * still compile. This script builds them to be *published*: same commands, one
 * extra argument each so the output works from a subdirectory, and every
 * result copied to the same place regardless of whether Vite, Storybook or the
 * Angular CLI produced it.
 *
 *   node scripts/build-demos.mjs                    # all 32 → demo-dist/
 *   node scripts/build-demos.mjs --only acme/bootstrap
 *   node scripts/build-demos.mjs --only acme-demo-bootstrap
 *   node scripts/build-demos.mjs --out /tmp/demos
 *
 * `--only` is what CI uses: one demo per matrix job, each uploading the slice
 * of demo-dist/ it produced, so a fleet of small parallel jobs assembles into
 * the same tree a single local run produces.
 *
 * Each demo's own `prebuild` recompiles its example's tokens first — that is
 * the harness's central claim (a demo renders `dist/`, nothing else) and it is
 * deliberately not optimised away here, even though it means each example is
 * compiled eight times. A published demo showing anything other than what the
 * compiler emits from today's sources is the one bug this whole exhibit exists
 * to make impossible.
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { discoverDemos } from './lib/demos.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const only = arg('only');
const out = resolve(root, arg('out') ?? 'demo-dist');

const demos = discoverDemos(root).filter(
  (d) => !only || d.workspace === only || `${d.example}/${d.target}` === only,
);

if (!demos.length) {
  console.error(`✖ build-demos: --only ${only} matched no demo project`);
  process.exit(1);
}

/** Directory size, for the one number that decides whether this is deployable. */
const bytes = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = join(dir, e.name);
    return sum + (e.isDirectory() ? bytes(p) : statSync(p).size);
  }, 0);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

let total = 0;
const started = Date.now();

for (const [i, demo] of demos.entries()) {
  const label = `${demo.example}/${demo.target}`;
  console.log(`\n▸ [${i + 1}/${demos.length}] ${label} (${demo.profile})`);

  // Run through npm from the repo root so the workspace's own pre/post scripts
  // fire and its binaries resolve exactly as they do for a contributor typing
  // `npm run build -w <name>` — a publish path that builds differently from the
  // documented one is a publish path nobody has actually tested.
  const args = ['run', 'build', '-w', demo.workspace];
  if (demo.buildArgs.length) args.push('--', ...demo.buildArgs);
  const res = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`\n✖ build-demos: ${label} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
  if (!existsSync(demo.outDir)) {
    console.error(`\n✖ build-demos: ${label} built but produced no ${demo.outDir}`);
    process.exit(1);
  }

  const dest = join(out, demo.example, demo.target);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(demo.outDir, dest, { recursive: true });

  const size = bytes(dest);
  total += size;
  console.log(`  ↳ ${dest.replace(root + '/', '')} — ${mb(size)}`);
}

console.log(
  `\n✔ ${demos.length} demo${demos.length === 1 ? '' : 's'} built — ${mb(total)} in ${((Date.now() - started) / 1000).toFixed(0)}s`,
);
