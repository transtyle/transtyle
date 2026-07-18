#!/usr/bin/env node
/**
 * transtyle CLI (docs/specs/cli.md). Skeleton commands: build, check.
 * Human logs → stderr; exit codes: 0 ok, 1 diagnostics ≥ fail-on, 2 usage error.
 */

import path from 'node:path';
import process from 'node:process';
import { compile } from '@transtyle/core';

const OFFICIAL_EXPORTERS = {
  shadcn: '@transtyle/exporter-shadcn',
  echarts: '@transtyle/exporter-echarts',
};

async function loadExporter(name) {
  const pkg = OFFICIAL_EXPORTERS[name] ?? name;
  try {
    return (await import(pkg)).default;
  } catch (e) {
    throw new Error(`Cannot load exporter for target "${name}" (tried "${pkg}"): ${e.message}`);
  }
}

function parseArgs(argv) {
  const args = { command: undefined, targets: [], cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') args.cwd = path.resolve(argv[++i] ?? '.');
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) { console.error(`Unknown flag: ${a}`); process.exit(2); }
    else if (!args.command) args.command = a;
    else args.targets.push(a);
  }
  return args;
}

const HELP = `transtyle — design system compiler (walking skeleton)

Usage:
  transtyle build [target...]   compile configured targets (default: all)
  transtyle check [target...]   run the pipeline without writing files
Options:
  --cwd <dir>                   project directory (with transtyle.config.json)
`;

const ICONS = { error: '✖', warning: '⚠', info: 'ℹ' };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) { console.error(HELP); process.exit(args.help ? 0 : 2); }
  if (!['build', 'check'].includes(args.command)) {
    console.error(`Unknown command: ${args.command}\n${HELP}`);
    process.exit(2);
  }

  const emit = args.command === 'build';
  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: args.targets, emit, loadExporter });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }

  const { diagnostics, results, config } = result;

  for (const d of diagnostics.items) {
    console.error(`${ICONS[d.severity] ?? '·'} ${d.code} ${d.message}`);
  }

  for (const r of results) {
    const counts = {};
    for (const c of r.coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
    const total = r.coverage.length || 1;
    const pct = (k) => (counts[k] ? `${Math.round((counts[k] / total) * 100)}% ${k}` : null);
    const bar = ['native', 'derived', 'approximated', 'dropped', 'unsupported'].map(pct).filter(Boolean).join(' · ');
    console.error(`\n${r.target}  ${bar}`);
    if (emit) for (const f of r.files) console.error(`  ↳ ${f}`);
  }

  const failOn = config.check?.failOn ?? 'error';
  if (diagnostics.shouldFail(failOn)) {
    console.error(`\n✖ failed (fail-on: ${failOn})`);
    process.exit(1);
  }
  console.error(emit ? '\n✔ build complete' : '\n✔ check passed');
}

main();
