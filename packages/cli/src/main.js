#!/usr/bin/env node
/**
 * transtyle CLI (docs/specs/cli.md). Commands: build, check, explain, init, add.
 * Human logs → stderr; exit codes: 0 ok, 1 diagnostics ≥ fail-on, 2 usage error.
 */

import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { compile, formatColor, formatHex } from '@transtyle/core';

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
  transtyle init [name]           scaffold transtyle.config.json + tokens/tokens.json
  transtyle add <target>          add a target to transtyle.config.json
Options:
  --cwd <dir>                     project directory (with transtyle.config.json)
  --mode <name>                   mode to resolve for (explain only; default: the DS's default mode)
  --json                          check only: also print a machine-readable report to stdout
`;

const ICONS = { error: '✖', warning: '⚠', info: 'ℹ' };
const COMMANDS = ['build', 'check', 'explain', 'init', 'add'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) { console.error(HELP); process.exit(args.help ? 0 : 2); }
  if (!COMMANDS.includes(args.command)) {
    console.error(`Unknown command: ${args.command}\n${HELP}`);
    process.exit(2);
  }

  if (args.command === 'explain') return cmdExplain(args);
  if (args.command === 'init') return cmdInit(args);
  if (args.command === 'add') return cmdAdd(args);
  return cmdBuildOrCheck(args);
}

// ---------- build / check ----------

async function cmdBuildOrCheck(args) {
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
    result = await compile({ cwd: args.cwd, targets: [], emit: false, loadExporter });
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(2);
  }
  const { normalized, diagnostics } = result;
  for (const d of diagnostics.items) console.error(`${ICONS[d.severity] ?? '·'} ${d.code} ${d.message}`);

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
  3. npx transtyle add <target>   (shadcn, daisyui, bootstrap, storybook, css-variables)`);
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
