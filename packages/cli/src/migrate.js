/**
 * `transtyle migrate --from style-dictionary [--write]` (docs/specs/cli.md,
 * issue #54). The transform is core's `migrateStyleDictionary()`; this file
 * walks the config's token files, prints the diff, and writes only with
 * `--write`. Zero dependencies: the diff is a small line diff of the
 * normalized (re-serialized) before and after, so formatting noise never shows.
 */

import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { loadConfig, expandTokenFiles, migrateStyleDictionary, needsStyleDictionaryMigration } from '@transtyle/core';

export const MIGRATE_SOURCES = ['style-dictionary'];

/** Indentation of a JSON text: a tab, or the width of its first indented line (default 2). */
export function detectIndent(text) {
  const m = text.match(/^([ \t]+)\S/m);
  if (!m) return 2;
  return m[1][0] === '\t' ? '\t' : m[1].length;
}

/**
 * Line diff in unified style (3 lines of context). The common head and tail
 * are trimmed first and the middle is diffed by longest common subsequence;
 * a middle too big for that is shown as one removed and one added block.
 */
export function lineDiff(before, after, context = 3) {
  const a = before.split('\n');
  const b = after.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ma = a.slice(head, a.length - tail);
  const mb = b.slice(head, b.length - tail);
  const ops = [];
  for (let i = 0; i < head; i++) ops.push([' ', a[i]]);
  if (ma.length * mb.length > 4_000_000) {
    for (const l of ma) ops.push(['-', l]);
    for (const l of mb) ops.push(['+', l]);
  } else {
    const w = mb.length + 1;
    const lcs = new Uint32Array((ma.length + 1) * w);
    for (let i = ma.length - 1; i >= 0; i--) {
      for (let j = mb.length - 1; j >= 0; j--) {
        lcs[i * w + j] = ma[i] === mb[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < ma.length || j < mb.length) {
      if (i < ma.length && j < mb.length && ma[i] === mb[j]) { ops.push([' ', ma[i]]); i++; j++; }
      else if (j < mb.length && (i === ma.length || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) ops.push(['+', mb[j++]]);
      else ops.push(['-', ma[i++]]);
    }
  }
  for (let i = a.length - tail; i < a.length; i++) ops.push([' ', a[i]]);

  const keep = new Array(ops.length).fill(false);
  ops.forEach(([op], i) => {
    if (op === ' ') return;
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
  });
  const lines = [];
  let gap = false;
  ops.forEach(([op, text], i) => {
    if (!keep[i]) { gap = true; return; }
    if (gap && lines.length) lines.push('  ⋮');
    gap = false;
    lines.push(`${op} ${text}`);
  });
  return lines.join('\n');
}

/**
 * The command. `args`: `{ cwd, from, write, targets }`. Exit codes as the
 * rest of the CLI: 0 done (changes pending or not), 1 a token file did not
 * parse (nothing is written), 2 usage or config errors.
 */
export async function cmdMigrate(args) {
  if (args.from === undefined) {
    console.error(`✖ transtyle migrate needs --from <source> (${MIGRATE_SOURCES.join(', ')}); the IR-spec upgrade codemods are still specced`);
    process.exit(2);
  }
  if (!MIGRATE_SOURCES.includes(args.from)) {
    console.error(`✖ Unknown migrate source: ${args.from}\nValid sources: ${MIGRATE_SOURCES.join(', ')}`);
    process.exit(2);
  }
  if (args.targets.length) {
    console.error(`✖ transtyle migrate takes no arguments (got: ${args.targets.join(' ')})\n  Usage: transtyle migrate --from style-dictionary [--write]`);
    process.exit(2);
  }
  let files;
  try {
    const { config } = await loadConfig(args.cwd);
    files = await expandTokenFiles(args.cwd, config.tokens);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error(`✖ The config's "tokens" matched no files in ${args.cwd}`);
    process.exit(2);
  }

  const plans = [];
  let broken = 0;
  for (const file of files) {
    const rel = path.relative(args.cwd, file);
    let text;
    let tree;
    try {
      text = readFileSync(file, 'utf8');
      tree = JSON.parse(text);
    } catch (e) {
      console.error(`✖ TST1002 Failed to parse ${rel}: ${e.message}`);
      broken++;
      continue;
    }
    if (!needsStyleDictionaryMigration(tree)) {
      console.error(`· ${rel}: not a Style Dictionary v3 file, left as it is`);
      continue;
    }
    const { tree: migrated, notes, tokens } = migrateStyleDictionary(tree);
    const indent = detectIndent(text);
    const after = JSON.stringify(migrated, null, indent) + '\n';
    plans.push({ file, rel, tokens, notes, after, diff: lineDiff(JSON.stringify(tree, null, indent) + '\n', after) });
  }
  if (broken) {
    console.error(`✖ ${broken} token file${broken === 1 ? '' : 's'} could not be parsed; nothing was changed.`);
    process.exit(1);
  }

  for (const p of plans) {
    if (!args.write) console.log(`--- ${p.rel}\n+++ ${p.rel} (migrated)\n${p.diff}\n`);
    console.error(`${args.write ? '✔ migrated' : '→ would migrate'} ${p.rel}: ${p.tokens} token${p.tokens === 1 ? '' : 's'}`);
    for (const n of p.notes) console.error(`  ↳ ${n}`);
    if (args.write) writeFileSync(p.file, p.after);
  }
  if (plans.length === 0) {
    console.error('Nothing to migrate: no token file is in the Style Dictionary v3 format.');
  } else if (!args.write) {
    console.error(`\nDry run: ${plans.length} file${plans.length === 1 ? '' : 's'} would change, nothing was written. Re-run with --write to apply.`);
  } else {
    console.error('\nNext: npx transtyle check');
  }
}
