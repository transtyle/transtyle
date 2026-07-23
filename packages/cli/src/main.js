#!/usr/bin/env node
/**
 * transtyle CLI (docs/specs/cli.md). Commands: build, check, explain, init, add.
 * Human logs → stderr; exit codes: 0 ok, 1 diagnostics ≥ fail-on, 2 usage error.
 */

import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { compile, diffResolved, contrastRegressions, formatColor, formatHex } from '@transtyle/core';

const OFFICIAL_EXPORTERS = {
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
 * Build a loader that resolves exporter packages **from the user's project
 * first**, then from the CLI's own install.
 *
 * A bare `import(pkg)` resolves relative to this file, which works for the
 * official exporters (they ship alongside the CLI) but makes third-party ones
 * unloadable whenever the CLI isn't inside the project's own node_modules — a
 * global install, a monorepo checkout, a hoisted binary. Project-first also lets
 * a project deliberately pin its own fork of an official exporter.
 */
function makeLoadExporter(cwd) {
  const requireFromProject = createRequire(path.join(cwd, 'noop.js'));
  return async function loadExporter(name) {
    const pkg = OFFICIAL_EXPORTERS[name] ?? name;
    const tried = [];
    try {
      return (await import(pathToFileURL(requireFromProject.resolve(pkg)).href)).default;
    } catch (e) {
      tried.push(`from the project (${cwd}): ${e.code ?? e.message}`);
    }
    try {
      return (await import(pkg)).default;
    } catch (e) {
      tried.push(`from the transtyle install: ${e.code ?? e.message}`);
    }
    throw new Error(
      `Cannot load exporter for target "${name}" (package "${pkg}"):\n  - ${tried.join('\n  - ')}\n` +
      `  Third-party exporters must be installed in this project: npm install ${pkg}`);
  };
}

function parseArgs(argv) {
  const args = { command: undefined, targets: [], cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') args.cwd = path.resolve(argv[++i] ?? '.');
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) { console.error(`Unknown flag: ${a}`); process.exit(2); }
    else if (!args.command) args.command = a;
    else args.targets.push(a);
  }
  return args;
}

const HELP = `transtyle — design system compiler

Usage:
  transtyle build [target...]     compile configured targets (default: all)
  transtyle check [target...]     run the pipeline without writing files
  transtyle explain <slot>        show a resolved slot's value, provenance, and rule inputs
  transtyle diff [ref]            semantic diff of the resolved graph vs a git ref (default: HEAD), with per-target impact
  transtyle init [name]           scaffold transtyle.config.json + tokens/tokens.json
  transtyle add <target>          add a target to transtyle.config.json
Options:
  --cwd <dir>                     project directory (with transtyle.config.json)
  --mode <name>                   mode to resolve for (explain only; default: the DS's default mode)
  --json                          check/diff only: also print a machine-readable report to stdout
`;

const ICONS = { error: '✖', warning: '⚠', info: 'ℹ' };

/**
 * One diagnostic, rendered. The `hint` (AL5) goes on its own indented line
 * rather than inside the message: what is wrong and what to change are
 * different sentences, and running them together is how the old one-liners
 * ended up saying neither well.
 */
function printDiagnostic(d) {
  console.error(`${ICONS[d.severity] ?? '·'} ${d.code} ${d.message}`);
  if (d.hint) console.error(`  ↳ ${d.hint}`);
}
const COMMANDS = ['build', 'check', 'explain', 'diff', 'init', 'add'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) { console.error(HELP); process.exit(args.help ? 0 : 2); }
  if (!COMMANDS.includes(args.command)) {
    console.error(`Unknown command: ${args.command}\n${HELP}`);
    process.exit(2);
  }

  if (args.command === 'explain') return cmdExplain(args);
  if (args.command === 'diff') return cmdDiff(args);
  if (args.command === 'init') return cmdInit(args);
  if (args.command === 'add') return cmdAdd(args);
  return cmdBuildOrCheck(args);
}

// ---------- build / check ----------

async function cmdBuildOrCheck(args) {
  const emit = args.command === 'build';
  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: args.targets, emit, loadExporter: makeLoadExporter(args.cwd), knownExporters: Object.keys(OFFICIAL_EXPORTERS) });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }

  const { diagnostics, results, config } = result;

  for (const d of diagnostics.items) printDiagnostic(d);

  for (const r of results) {
    const counts = {};
    for (const c of r.coverage) counts[c.class] = (counts[c.class] ?? 0) + 1;
    const total = r.coverage.length || 1;
    const pct = (k) => (counts[k] ? `${Math.round((counts[k] / total) * 100)}% ${k}` : null);
    const bar = ['native', 'derived', 'approximated', 'dropped', 'unsupported'].map(pct).filter(Boolean).join(' · ');
    console.error(`\n${r.target}  ${bar}`);
    if (emit) for (const f of r.files) console.error(`  ↳ ${f}`);
  }

  // Human logs → stderr (above); requested data → stdout (docs/specs/cli.md
  // "Behavioral contracts"). `check --json` is the only current consumer.
  if (!emit && args.json) {
    console.log(JSON.stringify({
      diagnostics: diagnostics.items,
      targets: results.map((r) => ({ target: r.target, coverage: r.coverage })),
    }, null, 2));
  }

  const failOn = config.check?.failOn ?? 'error';
  if (diagnostics.shouldFail(failOn)) {
    console.error(`\n✖ failed (fail-on: ${failOn})`);
    process.exit(1);
  }
  console.error(emit ? '\n✔ build complete' : '\n✔ check passed');
}

// ---------- explain ----------

async function cmdExplain(args) {
  const slotArg = args.targets[0];
  if (!slotArg) { console.error('Usage: transtyle explain <slot> [--mode <name>]'); process.exit(2); }

  let result;
  try {
    result = await compile({ cwd: args.cwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd) });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  const { normalized, diagnostics } = result;
  for (const d of diagnostics.items) printDiagnostic(d);

  const useMode = args.mode ?? normalized.defaultMode;
  const map = normalized.modes[useMode];
  if (!map) {
    console.error(`✖ Unknown mode "${useMode}" (available: ${normalized.modeValues.join(', ')})`);
    process.exit(2);
  }

  // A resolved provenance.inputs entry may be a bare relative path
  // ("primary.solid", "radius.md") or a fully-qualified one — try both
  // conventional prefixes before giving up.
  const resolvePath = (raw) => {
    for (const candidate of [raw, `semantic.${raw}`, `semantic.color.${raw}`]) {
      if (map.has(candidate)) return candidate;
    }
    return null;
  };

  const fullPath = resolvePath(slotArg);
  if (!fullPath) {
    const bare = slotArg.replace(/^semantic\.(color\.)?/, '');
    const closest = [...map.keys()]
      .map((k) => [k, levenshtein(bare, k.replace(/^semantic\.(color\.)?/, ''))])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([k]) => k);
    console.error(`✖ Unknown slot: ${slotArg}\n\nClosest matches:\n${closest.map((k) => `  ${k}`).join('\n')}`);
    process.exit(2);
  }

  printExplain(map, fullPath, resolvePath, 0, new Set([fullPath]));
}

function formatEntryValue(entry) {
  const { type, value } = entry;
  if (type === 'color') {
    try {
      return `${formatColor(value)}  [${formatHex(value).text}]`;
    } catch {
      return formatColor(value);
    }
  }
  if (type === 'typography') {
    return `{ family: ${value.fontFamily}, size: ${value.fontSize}, weight: ${value.fontWeight}, leading: ${value.lineHeight} }`;
  }
  if (type === 'shadow') {
    return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} / ${formatColor(value.color)}`;
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function printExplain(map, slotPath, resolvePath, depth, seen) {
  const entry = map.get(slotPath);
  const indent = '  '.repeat(depth);
  if (depth === 0) console.log(`${slotPath} = ${formatEntryValue(entry)}`);

  const prov = entry.provenance;
  if (prov.kind === 'authored') {
    console.log(`${indent} └─ authored`);
    return;
  }
  if (prov.kind === 'aliased') {
    console.log(`${indent} └─ aliased → ${prov.target}`);
    return;
  }
  // derived or defaulted
  console.log(`${indent} └─ ${prov.kind} by rule ${prov.rule ?? '(catalog default)'}`);
  if (!prov.inputs?.length || depth >= 6) return;
  for (const rawInput of prov.inputs) {
    const inputPath = resolvePath(rawInput) ?? rawInput;
    const inputEntry = map.get(inputPath);
    if (!inputEntry) {
      console.log(`${indent}    inputs: ${rawInput} (unresolved)`);
      continue;
    }
    if (seen.has(inputPath)) {
      console.log(`${indent}    inputs: ${inputPath} = ${formatEntryValue(inputEntry)} (see above)`);
      continue;
    }
    seen.add(inputPath);
    console.log(`${indent}    inputs: ${inputPath} = ${formatEntryValue(inputEntry)}`);
    printExplain(map, inputPath, resolvePath, depth + 2, seen);
  }
}

/** Levenshtein edit distance — used only for "did you mean" suggestions. */
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// ---------- diff ----------

/**
 * Semantic diff of the working tree against a git ref (default HEAD), plus
 * per-target impact. Resolves both sides with emit:false and diffs the resolved
 * graph (diffResolved) and the in-memory emitted files (docs/specs/diff.md).
 * Exit 0 = no changes; exit 1 = changes found (so it composes in CI, like `git
 * diff --exit-code`); exit 2 = usage/environment error.
 */
async function cmdDiff(args) {
  const ref = args.targets[0] ?? 'HEAD';

  // "after" = the working tree as it is now.
  let after;
  try {
    after = await compile({ cwd: args.cwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd) });
  } catch (e) { console.error(`✖ ${e.message}`); process.exit(2); }

  // "before" = the project at `ref`, materialized into a temp dir via git archive.
  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { cwd: args.cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { console.error('✖ transtyle diff requires a git repository'); process.exit(2); }
  try {
    execSync(`git rev-parse --verify --quiet ${ref}^{commit}`, { cwd: repoRoot, stdio: 'ignore' });
  } catch { console.error(`✖ Unknown git ref: ${ref}`); process.exit(2); }

  // The project's path relative to the repo root, straight from git — avoids the
  // macOS /var → /private/var symlink mismatch that path.relative(toplevel, cwd)
  // would produce (toplevel is realpath'd, cwd may be the symlink).
  const prefix = execSync('git rev-parse --show-prefix', { cwd: args.cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/\/$/, '');
  const tmp = mkdtempSync(path.join(tmpdir(), 'transtyle-diff-'));
  let before;
  try {
    execSync(`git archive ${ref} ${prefix} | tar -x -C "${tmp}"`, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    const beforeCwd = path.join(tmp, prefix);
    if (!existsSync(path.join(beforeCwd, 'transtyle.config.json'))) {
      console.error(`ℹ No transtyle project at ${ref} — nothing to diff against.`);
      rmSync(tmp, { recursive: true, force: true });
      process.exit(0);
    }
    before = await compile({ cwd: beforeCwd, targets: [], emit: false, loadExporter: makeLoadExporter(args.cwd) });
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    console.error(`✖ Could not resolve the project at ${ref}: ${e.message}`);
    process.exit(2);
  }
  rmSync(tmp, { recursive: true, force: true });

  const diff = diffResolved(before.normalized, after.normalized);
  const impact = diffTargets(before.results, after.results);
  const a11y = contrastRegressions(before.normalized, after.normalized, after.config);

  if (args.json) {
    console.log(JSON.stringify(serializeDiff(ref, diff, impact, a11y), null, 2));
  } else {
    printDiff(ref, diff, impact, a11y);
  }
  // Set exitCode rather than process.exit(): the JSON report can be tens of KB,
  // and process.exit() truncates an async stdout write to a pipe mid-flush.
  process.exitCode = diff.hasChanges ? 1 : 0;
}

/** Per-target impact: re-emit both sides (already done by compile) and diff file contents. */
function diffTargets(beforeResults, afterResults) {
  const byName = (rs) => new Map(rs.map((r) => [r.target, r]));
  const b = byName(beforeResults), a = byName(afterResults);
  const names = [...new Set([...b.keys(), ...a.keys()])].sort();
  const rows = [];
  for (const name of names) {
    const br = b.get(name), ar = a.get(name);
    if (!br) { rows.push({ target: name, status: 'new-target' }); continue; }
    if (!ar) { rows.push({ target: name, status: 'removed-target' }); continue; }
    const bf = new Map((br.emitted ?? []).map((f) => [f.path, f.contents]));
    const af = new Map((ar.emitted ?? []).map((f) => [f.path, f.contents]));
    let changedLines = 0; const samples = [];
    for (const [p, ac] of af) {
      if (p.endsWith('usage.md')) continue; // generated docs, not the theme itself
      const bc = bf.get(p);
      if (bc === ac) continue;
      const d = lineChanges(bc ?? '', ac);
      changedLines += d.length;
      for (const line of d) if (samples.length < 8) samples.push(`${p}: ${line}`);
    }
    rows.push({ target: name, status: 'changed', changedLines, samples });
  }
  return rows;
}

/** Meaningful (non-comment, non-blank) lines in `after` absent verbatim from `before`. */
function lineChanges(before, after) {
  const beforeLines = new Set(before.split('\n').map((l) => l.trim()));
  const out = [];
  for (const raw of after.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('*') || l.startsWith('//') || l.startsWith('/*')) continue;
    if (!beforeLines.has(l)) out.push(l);
  }
  return out;
}

function serializeDiff(ref, diff, impact, a11y = []) {
  return {
    ref,
    hasChanges: diff.hasChanges,
    contrastRegressions: a11y.map((r) => ({
      mode: r.mode, pair: `${r.fg} on ${r.bg}`, status: r.status,
      before: Number(r.before.toFixed(2)), after: Number(r.after.toFixed(2)), threshold: r.threshold,
    })),
    semantic: diff.modes.map((m) => ({
      mode: m.mode,
      added: m.added,
      removed: m.removed,
      changed: m.changed.map((c) => ({
        slot: c.slot,
        before: formatEntryValue(c.before),
        after: formatEntryValue(c.after),
        provenance: c.provChanged ? `${c.before.provenance.kind} → ${c.after.provenance.kind}` : c.after.provenance.kind,
      })),
    })),
    impact: impact.map((r) => ({ target: r.target, status: r.status, changedLines: r.changedLines ?? 0 })),
  };
}

function printDiff(ref, diff, impact, a11y = []) {
  if (!diff.hasChanges) {
    console.error(`No semantic changes vs ${ref} — compiled themes are identical.`);
    return;
  }
  console.error(`Semantic diff vs ${ref}:\n`);
  for (const m of diff.modes) {
    if (!m.added.length && !m.removed.length && !m.changed.length) continue;
    console.error(`[${m.mode}]`);
    for (const s of m.added) console.error(`  + ${s}`);
    for (const s of m.removed) console.error(`  - ${s}`);
    for (const c of m.changed) {
      const prov = c.provChanged ? `  (${c.before.provenance.kind} → ${c.after.provenance.kind})` : '';
      console.error(`  ~ ${c.slot}  ${formatEntryValue(c.before)} → ${formatEntryValue(c.after)}${prov}`);
    }
    console.error('');
  }
  console.error('Per-target impact:');
  for (const r of impact) {
    if (r.status === 'new-target') { console.error(`  ${r.target}: new target (not present at ${ref})`); continue; }
    if (r.status === 'removed-target') { console.error(`  ${r.target}: removed since ${ref}`); continue; }
    if (!r.changedLines) { console.error(`  ${r.target}: no output change`); continue; }
    console.error(`  ${r.target}: ${r.changedLines} line${r.changedLines === 1 ? '' : 's'} changed`);
    for (const s of r.samples) console.error(`      ${s}`);
  }

  // Last, so it stays on screen: this change's accessibility cost.
  if (a11y.length) {
    const regressed = a11y.filter((r) => r.status === 'regressed');
    console.error(`\n⚠ Contrast ${regressed.length ? 'regressions' : 'changes'}:`);
    for (const r of a11y) {
      const verb = r.status === 'regressed' ? 'now FAILS' : 'still fails';
      console.error(`  ${r.status === 'regressed' ? '✖' : '⚠'} ${r.fg} on ${r.bg} (${r.mode}): ${r.before.toFixed(1)}:1 → ${r.after.toFixed(1)}:1 — ${verb} ${r.threshold}:1`);
    }
    if (regressed.length) {
      console.error(`\n  ${regressed.length} pair${regressed.length === 1 ? '' : 's'} passed before this change and fail${regressed.length === 1 ? 's' : ''} after it.`);
    }
  }
}

// ---------- init ----------

async function cmdInit(args) {
  const configPath = path.join(args.cwd, 'transtyle.config.json');
  if (existsSync(configPath)) {
    console.error(`✖ transtyle.config.json already exists at ${configPath}`);
    process.exit(2);
  }
  const name = args.targets[0] ?? path.basename(args.cwd) ?? 'design-system';

  const config = {
    $schema: 'https://transtyle.dev/schemas/config/v0.json',
    name,
    tokens: ['tokens/*.tokens.json'],
    modes: { 'color-scheme': { values: ['light', 'dark'], default: 'light' } },
    derivation: { rules: 'standard@1', autoDark: false, require: ['semantic.color.primary'] },
    targets: { 'css-variables': { output: 'dist/css-variables' } },
    check: { failOn: 'error', contrast: { standard: 'wcag21-aa' } },
  };

  const td = (value, description) => ({ $value: value, $description: description });
  const tokens = {
    option: {
      color: { $type: 'color', brand: { 500: { $value: 'oklch(0.55 0.18 255)' } } },
    },
    semantic: {
      color: {
        $type: 'color',
        primary: { solid: td('{option.color.brand.500}', 'TODO: your brand color — the one non-negotiable input') },
        elevation: {
          0: { surface: td('oklch(1 0 0)', 'TODO: the page background') },
          1: { surface: td('oklch(0.98 0.003 255)', 'TODO: card/panel background') },
        },
        text: {
          base: td('oklch(0.2 0.01 255)', 'TODO: body text color'),
          muted: td('oklch(0.5 0.01 255)', 'TODO: muted/secondary text color'),
        },
        border: td('oklch(0.9 0.005 255)', 'TODO: default border color'),
      },
      radius: { md: { $type: 'dimension', $value: '0.5rem' } },
      font: {
        sans: { $type: 'fontFamily', $value: ['system-ui', 'sans-serif'] },
        mono: { $type: 'fontFamily', $value: ['ui-monospace', 'monospace'] },
      },
    },
  };

  mkdirSync(path.join(args.cwd, 'tokens'), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  writeFileSync(path.join(args.cwd, 'tokens/brand.tokens.json'), JSON.stringify(tokens, null, 2) + '\n');

  console.error(`✔ created transtyle.config.json + tokens/brand.tokens.json in ${args.cwd}`);
  console.error(`
Next steps:
  1. Edit tokens/brand.tokens.json — replace the TODO placeholders with your brand.
  2. npx transtyle build          (starts with css-variables; add more with "add")
  3. npx transtyle add <target>   (${Object.keys(OFFICIAL_EXPORTERS).join(', ')})`);
}

// ---------- add ----------

async function cmdAdd(args) {
  const target = args.targets[0];
  if (!target) { console.error('Usage: transtyle add <target>'); process.exit(2); }
  if (!(target in OFFICIAL_EXPORTERS)) {
    console.error(`✖ Unknown target: ${target}\nValid targets: ${Object.keys(OFFICIAL_EXPORTERS).join(', ')}`);
    process.exit(2);
  }
  const configPath = path.join(args.cwd, 'transtyle.config.json');
  if (!existsSync(configPath)) {
    console.error(`✖ No transtyle.config.json in ${args.cwd} — run "transtyle init" first`);
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.targets ??= {};
  if (config.targets[target]) {
    console.error(`✖ Target "${target}" is already configured`);
    process.exit(2);
  }
  config.targets[target] = { output: `dist/${target}` };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.error(`✔ added target "${target}" → dist/${target}\n\nBuild it: npx transtyle build ${target}`);
}

main();
